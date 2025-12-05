/**
 * AI Client Wrapper for Student Portal API
 * Handles all AI operations: ASR, Translation, and Summaries
 */

const STUDENT_PORTAL_BASE_URL =
  process.env.STUDENT_PORTAL_URL || 'https://space.ai-builders.com/backend';

interface TranscriptionResponse {
  request_id: string;
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence?: number;
  }>;
  detected_language?: string;
  duration_seconds?: number;
  confidence?: number;
}

interface ChatCompletionResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<any>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DailySummaryResult {
  topic_summary_zh: string;
  topic_summary_en: string;
  whats_new_zh?: string;
  whats_new_en?: string;
  phrases: Array<{
    phrase_en: string;
    phrase_zh: string;
    explanation_zh?: string;
    example_en?: string;
    example_zh?: string;
  }>;
}

/**
 * Get the API key from environment variables
 */
export function getApiKey(): string {
  const apiKey = process.env.SUPER_MIND_API_KEY || process.env.AI_BUILDER_TOKEN;
  if (!apiKey) {
    throw new Error(
      'SUPER_MIND_API_KEY or AI_BUILDER_TOKEN environment variable is not set'
    );
  }
  return apiKey;
}

/**
 * Transcribe audio file to text
 * @param audioFile - File, Blob, or Buffer containing audio data
 * @param language - Optional language hint (zh, zh-CN, en, en-US)
 */
export async function transcribeAudio(
  audioFile: File | Blob | Buffer,
  language?: 'zh' | 'zh-CN' | 'en' | 'en-US'
): Promise<TranscriptionResponse> {
  const apiKey = getApiKey();
  
  // Create FormData
  const formData = new FormData();
  
  // Handle different input types
  if (Buffer.isBuffer(audioFile)) {
    // Node.js environment - Convert Buffer to Blob for FormData
    // Blob is available globally in Node.js 18+
    const blob = new Blob([audioFile as BlobPart], { type: 'audio/webm' });
    // Use Blob directly - FormData in Node.js accepts Blob
    formData.append('audio_file', blob, 'audio.webm');
  } else {
    // Browser environment or File/Blob from Next.js FormData
    formData.append('audio_file', audioFile);
  }
  
  if (language) {
    formData.append('language', language);
  }

  const url = `${STUDENT_PORTAL_BASE_URL}/v1/audio/transcriptions`;
  console.log('Transcribing audio to:', url);
  console.log('Audio file size:', audioFile instanceof Buffer ? audioFile.length : 'unknown');
  console.log('Language:', language);
  
  // Normalize language code - API might prefer simpler format
  let languageCode = language;
  if (language === 'zh-CN') {
    languageCode = 'zh'; // Try simpler format
  } else if (language === 'en-US') {
    languageCode = 'en'; // Try simpler format
  }
  
  // Recreate FormData with normalized language
  const normalizedFormData = new FormData();
  if (Buffer.isBuffer(audioFile)) {
    const blob = new Blob([audioFile as BlobPart], { type: 'audio/webm' });
    normalizedFormData.append('audio_file', blob, 'audio.webm');
  } else {
    normalizedFormData.append('audio_file', audioFile);
  }
  if (languageCode) {
    normalizedFormData.append('language', languageCode);
  }
  
  // Declare timeoutId outside try-catch so it's accessible in catch block
  let timeoutId: NodeJS.Timeout | null = null;
  
  try {
    // Use keep-alive for connection reuse (faster subsequent requests)
    // Add signal timeout to fail fast if API is slow
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for audio (balanced for speed and reliability)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Don't set Content-Type - let fetch set it with boundary for multipart/form-data
        'Connection': 'keep-alive', // Reuse connection for faster requests
      },
      body: normalizedFormData,
      keepalive: true, // Keep connection alive for reuse
      signal: controller.signal,
    });
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
        // Try to parse as JSON for more details
        try {
          const errorJson = JSON.parse(errorText);
          console.error('API Error Response:', JSON.stringify(errorJson, null, 2));
          errorText = JSON.stringify(errorJson, null, 2);
        } catch {
          // Not JSON, use as-is
        }
      } catch (e) {
        errorText = 'Could not read error response';
      }
      
      // Try to extract more details from error response
      let errorDetails = errorText;
      let parsedError: any = null;
      try {
        parsedError = JSON.parse(errorText);
        if (parsedError.detail) {
          errorDetails = JSON.stringify(parsedError.detail, null, 2);
        } else if (parsedError.message) {
          errorDetails = parsedError.message;
        }
      } catch {
        // Not JSON, use as-is
      }
      
      console.error('Transcription API Error:', {
        status: response.status,
        statusText: response.statusText,
        url,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
        parsedError,
      });
      
      throw new Error(
        `Transcription failed: ${response.status} ${response.statusText}\n` +
        `Details: ${errorDetails}`
      );
    }

    const data = await response.json();
    console.log('Transcription success:', { requestId: data.request_id, textLength: data.text?.length });
    return data;
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    // Handle abort/timeout errors
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
      throw new Error(
        `Transcription request timed out after 20 seconds. ` +
        `The API may be slow or overloaded. Please try again.`
      );
    }
    // Provide helpful error messages for common issues
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      const cause = (error as any).cause;
      if (cause?.code === 'ENOTFOUND') {
        throw new Error(
          `Cannot resolve hostname: ${new URL(STUDENT_PORTAL_BASE_URL).hostname}. ` +
          `Please check:\n` +
          `1. Your network connection\n` +
          `2. The STUDENT_PORTAL_URL environment variable (currently: ${STUDENT_PORTAL_BASE_URL})\n` +
          `3. DNS resolution for the API hostname\n` +
          `Original error: ${cause.message}`
        );
      }
    }
    throw error;
  }
}

/**
 * Translate text using chat completions
 */
export async function translateText(
  text: string,
  sourceLang: 'zh-CN' | 'en-US',
  targetLang: 'zh-CN' | 'en-US',
  model: 'gpt-5' | 'gemini-2.5-pro' = 'gpt-5'
): Promise<{ translatedText: string; requestId: string }> {
  const apiKey = getApiKey();

  // Warn if input is very long (might cause timeout)
  const textLength = text.length;
  if (textLength > 500) {
    console.warn(`Long input text detected (${textLength} chars). Translation may take longer.`);
  }

  // Determine system prompt based on translation direction
  let systemPrompt: string;
  if (sourceLang === 'zh-CN' && targetLang === 'en-US') {
    systemPrompt =
      'You are a precise translator from Chinese to natural spoken English. Keep responses short and conversational. Do not add explanations.';
  } else if (sourceLang === 'en-US' && targetLang === 'zh-CN') {
    systemPrompt =
      'You are a precise translator from English to natural, simple spoken Chinese. Use vocabulary appropriate for a 60-year-old Chinese learner. Do not add explanations.';
  } else {
    throw new Error(`Unsupported translation: ${sourceLang} -> ${targetLang}`);
  }

  // Optimize for speed: Use gpt-5 (more reliable than gemini-2.5-pro which has token limit issues)
  // Keep token limit optimized but sufficient for translations
  const optimizedModel = model; // Use requested model (gpt-5 is more reliable)
  
  // Adjust max_tokens based on input length (longer inputs need more output tokens)
  // Estimate: Chinese chars are ~1 token, English words are ~1.3 tokens
  // For safety, allocate more tokens for longer inputs
  // Use 1024 as minimum to avoid API bug where it returns empty content with lower limits
  // This prevents retry delays (retry added 14s in testing)
  const estimatedInputTokens = sourceLang === 'zh-CN' ? textLength : Math.ceil(textLength / 4);
  const maxTokens = Math.min(Math.max(estimatedInputTokens * 3, 1024), 2048); // Between 1024 and 2048 (prevents retry)
  
  const requestBody = {
    model: optimizedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  };
  
  // Store maxTokens for error handling
  const finalMaxTokens = maxTokens;

  // Use keep-alive for connection reuse and optimize for speed
  // Dynamic timeout: longer inputs get more time (base 30s + 1s per 100 chars)
  // Increased base timeout to handle API delays even for short texts
  const timeoutMs = Math.min(30000 + Math.floor(textLength / 100) * 1000, 60000); // Max 60s
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | null = setTimeout(() => controller.abort(), timeoutMs);
  
  let response: Response;
  const finalTimeoutMs = timeoutMs; // Store for error message
  try {
    response = await fetch(`${STUDENT_PORTAL_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Connection': 'keep-alive', // Reuse connection
      },
      body: JSON.stringify(requestBody),
      keepalive: true, // Keep connection alive for reuse
      signal: controller.signal,
    });
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    // Handle abort/timeout errors
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
      const timeoutSeconds = Math.floor(finalTimeoutMs / 1000);
      throw new Error(
        `Translation request timed out after ${timeoutSeconds} seconds. ` +
        `Input text was ${textLength} characters. ` +
        `The API may be slow or overloaded. Please try shorter input or try again.`
      );
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Translation failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: ChatCompletionResponse = await response.json();
  
  // Log the full response for debugging
  console.log('Translation API Response:', {
    id: data.id,
    model: data.model,
    choicesCount: data.choices?.length,
    firstChoice: data.choices?.[0] ? {
      index: data.choices[0].index,
      finishReason: data.choices[0].finish_reason,
      messageRole: data.choices[0].message?.role,
      messageContent: data.choices[0].message?.content,
      messageContentLength: data.choices[0].message?.content?.length,
      hasToolCalls: !!data.choices[0].message?.tool_calls,
      toolCallsCount: data.choices[0].message?.tool_calls?.length,
    } : null,
  });

  let translatedText = data.choices[0]?.message?.content;

  if (!translatedText) {
    // Provide more detailed error information
    const choice = data.choices?.[0];
    const message = choice?.message;
    
    // Check if it's a token limit issue
    if (choice?.finish_reason === 'length') {
      // With max_tokens: 1024, this should rarely happen. If it does, it's likely a real long translation
      throw new Error(
        `Translation was cut off due to token limit. ` +
        `Input: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (${textLength} chars). ` +
        `max_tokens was ${finalMaxTokens}, completion_tokens: ${data.usage?.completion_tokens}. ` +
        `This may indicate the translation is too long or max_tokens needs adjustment.`
      );
    }
    const finishReason = choice?.finish_reason;
    const toolCalls = message?.tool_calls;
    
    let errorDetails = 'Translation response did not contain text.';
    errorDetails += `\nFinish reason: ${finishReason || 'unknown'}`;
    errorDetails += `\nHas tool calls: ${toolCalls ? 'yes (' + toolCalls.length + ')' : 'no'}`;
    errorDetails += `\nMessage role: ${message?.role || 'unknown'}`;
    errorDetails += `\nFull response structure: ${JSON.stringify(data, null, 2)}`;
    
    console.error('Translation response missing text:', errorDetails);
    throw new Error(errorDetails);
  }

  return {
    translatedText,
    requestId: data.id,
  };
}

/**
 * Tag a conversation with a situation tag
 */
export async function tagConversation(
  turns: Array<{ sourceText: string; translatedText: string }>
): Promise<{ situationTag: string; requestId: string }> {
  const apiKey = getApiKey();

  const conversationText = turns
    .map(
      (turn, idx) =>
        `Turn ${idx + 1}:\nSource: ${turn.sourceText}\nTranslation: ${turn.translatedText}`
    )
    .join('\n\n');

  const prompt = `Analyze this conversation. Return a JSON object with a single key 'situation_tag' (e.g., 'kitchen', 'baby', 'food', 'postpartum', 'health', 'shopping', 'family', 'daily_routine').

Conversation:
${conversationText}

Return only valid JSON, no other text.`;

  const requestBody = {
    model: 'gpt-5',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 100,
  };

  // Use keep-alive for connection reuse
  const response = await fetch(`${STUDENT_PORTAL_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Connection': 'keep-alive', // Reuse connection
    },
    body: JSON.stringify(requestBody),
    keepalive: true, // Keep connection alive for reuse
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Tagging failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: ChatCompletionResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Tagging response did not contain content');
  }

  // Parse JSON response
  let tagResult: { situation_tag: string };
  try {
    // Try to extract JSON from the response (in case model adds extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      tagResult = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (error) {
    throw new Error(`Failed to parse tagging response: ${content}`);
  }

  return {
    situationTag: tagResult.situation_tag,
    requestId: data.id,
  };
}

/**
 * Generate daily summary from conversation turns
 */
export async function generateDailySummary(
  turns: Array<{
    sourceText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    endedAt: Date;
  }>
): Promise<{ summary: DailySummaryResult; requestId: string }> {
  const apiKey = getApiKey();
  
  // Verify API key is present (getApiKey throws if not set, but log for debugging)
  console.log('Summary generation - API key present:', !!apiKey);
  console.log('Summary generation - API URL:', `${STUDENT_PORTAL_BASE_URL}/v1/chat/completions`);

  const conversationsText = turns
    .map(
      (turn, idx) =>
        `Conversation ${idx + 1} (${turn.sourceLang} -> ${turn.targetLang}):\nSource: ${turn.sourceText}\nTranslation: ${turn.translatedText}`
    )
    .join('\n\n');

  const prompt = `Summarize these conversations from today. Return a JSON object with the following structure:
{
  "topic_summary_zh": "简短的中文主题总结",
  "topic_summary_en": "Brief English topic summary",
  "whats_new_zh": "今天有什么新内容（可选）",
  "whats_new_en": "What's new today (optional)",
  "phrases": [
    {
      "phrase_en": "English phrase",
      "phrase_zh": "中文短语",
      "explanation_zh": "简短解释（可选）",
      "example_en": "Usage example (optional)",
      "example_zh": "使用示例（可选）"
    }
  ]
}

Include exactly 5 phrases in the phrases array. Focus on useful, practical English phrases that would help a Chinese speaker communicate.

Conversations:
${conversationsText}

Return only valid JSON, no other text.`;

  // Calculate max_tokens dynamically based on number of turns
  // Base: 2000 tokens (sufficient for 2-3 turns)
  // Additional: 500 tokens per turn beyond 3 turns
  // Maximum: 5000 tokens (to prevent excessive limits)
  // This ensures we have enough tokens for longer summaries without wasting resources
  const baseTokens = 2000;
  const tokensPerTurn = 500;
  const maxAllowedTokens = 5000;
  const calculatedMaxTokens = Math.min(
    baseTokens + Math.max(0, (turns.length - 3) * tokensPerTurn),
    maxAllowedTokens
  );

  const requestBody = {
    model: 'gpt-5',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: calculatedMaxTokens,
  };

  // Log request details for debugging
  console.log('Summary generation request:', {
    model: requestBody.model,
    promptLength: prompt.length,
    turnsCount: turns.length,
    temperature: requestBody.temperature,
    maxTokens: requestBody.max_tokens,
    calculatedMaxTokens: calculatedMaxTokens,
    apiUrl: `${STUDENT_PORTAL_BASE_URL}/v1/chat/completions`,
  });

  // Add timeout handling (summary generation can take longer due to more complex processing)
  const timeoutMs = 60000; // 60 seconds for summary generation
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | null = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    // Use keep-alive for connection reuse
    response = await fetch(`${STUDENT_PORTAL_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Connection': 'keep-alive', // Reuse connection
      },
      body: JSON.stringify(requestBody),
      keepalive: true, // Keep connection alive for reuse
      signal: controller.signal,
    });
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    // Handle network errors, timeouts, and abort errors
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        throw new Error(
          `Summary generation request timed out after ${timeoutMs / 1000} seconds. ` +
          `The API may be slow or overloaded. Please try again.`
        );
      }
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new Error(
          `Network error while generating summary: ${error.message}. ` +
          `Please check your internet connection and verify the API URL: ${STUDENT_PORTAL_BASE_URL}`
        );
      }
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Summary generation failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: ChatCompletionResponse = await response.json();
  
  // Log the full response for debugging
  console.log('Summary API Response:', {
    id: data.id,
    model: data.model,
    choicesCount: data.choices?.length,
    firstChoice: data.choices?.[0] ? {
      index: data.choices[0].index,
      finishReason: data.choices[0].finish_reason,
      messageRole: data.choices[0].message?.role,
      messageContentLength: data.choices[0].message?.content?.length,
    } : null,
    usage: data.usage,
  });
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error(`Summary response has no choices. Full response: ${JSON.stringify(data)}`);
  }

  const choice = data.choices[0];
  const content = choice?.message?.content;

  if (!content) {
    const finishReason = choice?.finish_reason;
    
    // Check if it's a token limit issue
    if (finishReason === 'length') {
      throw new Error(
        `Summary generation was cut off due to token limit. ` +
        `max_tokens was 2000, completion_tokens: ${data.usage?.completion_tokens}. ` +
        `This may indicate the summary is too long or max_tokens needs adjustment.`
      );
    }
    
    let errorDetails = 'Summary response did not contain content.';
    errorDetails += `\nFinish reason: ${finishReason || 'unknown'}`;
    errorDetails += `\nMessage role: ${choice?.message?.role || 'unknown'}`;
    errorDetails += `\nUsage: ${JSON.stringify(data.usage)}`;
    errorDetails += `\nFull response: ${JSON.stringify(data, null, 2)}`;
    
    console.error('Summary generation error:', errorDetails);
    throw new Error(errorDetails);
  }

  // Parse JSON response
  let summary: DailySummaryResult;
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      summary = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (error) {
    throw new Error(`Failed to parse summary response: ${content}`);
  }

  // Validate structure
  if (!summary.topic_summary_zh || !summary.topic_summary_en || !summary.phrases) {
    throw new Error('Invalid summary structure returned');
  }

  if (!Array.isArray(summary.phrases) || summary.phrases.length !== 5) {
    throw new Error('Summary must contain exactly 5 phrases');
  }

  return {
    summary,
    requestId: data.id,
  };
}

