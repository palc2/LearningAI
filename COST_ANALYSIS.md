# Cost Analysis for Family Voice Bridge

## Overview
This document estimates the cost per user session and potential costs if random people test your application at https://pc2-family-voice-bridge.ai-builders.space/

## API Usage Per Conversation Session

### Standard Flow (2-turn conversation)

Each complete conversation session makes the following API calls:

1. **Mom Turn (Chinese → English)**
   - 1x ASR call: `/v1/audio/transcriptions` (Chinese audio)
   - 1x Translation call: `/v1/chat/completions` with `gpt-5` model (Chinese → English)

2. **Partner Turn (English → Chinese)**
   - 1x ASR call: `/v1/audio/transcriptions` (English audio)
   - 1x Translation call: `/v1/chat/completions` with `gpt-5` model (English → Chinese)

3. **Tagging (Background, optional)**
   - 1x Chat completion: `/v1/chat/completions` with `gpt-5` model (~100 tokens)

4. **Daily Summary (Per day, not per session)**
   - 1x Chat completion: `/v1/chat/completions` with `gpt-5` model (2000-5000 tokens depending on conversation count)

**Total per session:**
- 2 ASR calls
- 3 Chat completion calls (2 translations + 1 tagging)
- 1 Daily summary call per day (shared across all sessions)

## Cost Estimation

### Assumptions

Based on your code analysis:
- **ASR**: Uses `/v1/audio/transcriptions` endpoint (likely OpenAI Whisper or similar)
- **Translation**: Uses `gpt-5` model via `/v1/chat/completions`
- **Tagging**: Uses `gpt-5` model with small prompt (~100 tokens)
- **Summary**: Uses `gpt-5` model with dynamic token limits (2000-5000 tokens)

### Typical Usage Patterns

**Per Session:**
- Audio length: ~5-10 seconds per turn (2 turns = 10-20 seconds total)
- Chinese text: ~10-30 characters per turn
- English text: ~5-15 words per turn
- Translation prompt: ~50-100 tokens input, ~50-100 tokens output
- Tagging prompt: ~200-300 tokens input, ~20-50 tokens output

### Cost Breakdown (Estimated)

**Note:** Since you're using the Student Portal API (`https://space.ai-builders.com/backend`), actual pricing depends on their backend provider costs. The following estimates are based on typical OpenAI/Whisper pricing:

#### 1. ASR (Audio Transcription)
- **Provider**: Likely OpenAI Whisper API
- **Cost**: ~$0.006 per minute of audio
- **Per session**: 2 calls × ~10 seconds = ~0.33 minutes
- **Cost per session**: ~$0.002 (0.33 min × $0.006/min)

#### 2. Translation Calls (Chat Completions - gpt-5)
- **Model**: `gpt-5` (OpenAI-compatible, pricing unknown - estimating based on GPT-4)
- **Estimated cost**: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- **Per translation**: 
  - Input: ~100 tokens (system prompt + user text)
  - Output: ~50-100 tokens (translated text)
  - Cost: ~$0.006 per translation
- **2 translations per session**: ~$0.012

#### 3. Tagging Call
- **Model**: `gpt-5`
- **Input**: ~200-300 tokens (conversation history)
- **Output**: ~20-50 tokens (JSON tag)
- **Cost**: ~$0.003 per session

#### 4. Daily Summary Call
- **Model**: `gpt-5`
- **Input**: ~500-2000 tokens (all conversations for the day)
- **Output**: ~500-1000 tokens (summary + 5 phrases)
- **Cost**: ~$0.03-0.09 per day (not per session)

### Total Cost Per Session

**Minimum estimate (conservative):**
- ASR: $0.002
- Translations: $0.012
- Tagging: $0.003
- **Total: ~$0.017 per session**

**Maximum estimate (if longer conversations):**
- ASR: $0.004 (longer audio)
- Translations: $0.024 (longer texts)
- Tagging: $0.005
- **Total: ~$0.033 per session**

**Average estimate: ~$0.02-0.025 per session**

### Daily Summary Cost
- **Per day**: ~$0.03-0.09 (regardless of session count)
- **Per session** (if 10 sessions/day): ~$0.003-0.009

## Cost Scenarios for Random Testers

### Scenario 1: Light Testing (10 random users, 5 sessions each)
- **Sessions**: 50 sessions
- **Cost**: 50 × $0.025 = **$1.25**
- **Daily summary**: $0.05 (assuming 1 per user)
- **Total**: **~$1.30**

### Scenario 2: Moderate Testing (50 random users, 10 sessions each)
- **Sessions**: 500 sessions
- **Cost**: 500 × $0.025 = **$12.50**
- **Daily summary**: $0.25 (assuming 1 per user)
- **Total**: **~$12.75**

### Scenario 3: Heavy Testing (100 random users, 20 sessions each)
- **Sessions**: 2,000 sessions
- **Cost**: 2,000 × $0.025 = **$50.00**
- **Daily summary**: $0.50 (assuming 1 per user)
- **Total**: **~$50.50**

### Scenario 4: Abuse/Malicious Testing (1 user, 1000 sessions)
- **Sessions**: 1,000 sessions
- **Cost**: 1,000 × $0.025 = **$25.00**
- **Daily summary**: $0.05
- **Total**: **~$25.05**

## Cost Mitigation Strategies

### 1. Rate Limiting
Your code already has some rate limiting considerations:
- Location: `app/api/vocabulary/daily/route.ts` mentions delays to avoid rate limiting
- **Recommendation**: Implement per-IP or per-user rate limits

### 2. Authentication/Authorization
- **Current state**: No authentication visible in the code
- **Recommendation**: Add basic authentication or API keys to prevent abuse

### 3. Cost Monitoring
- The Student Portal API has `/v1/usage/summary` endpoint that tracks costs
- **Recommendation**: Monitor usage regularly and set up alerts

### 4. Session Limits
- **Recommendation**: Limit sessions per user/IP per day (e.g., 20-50 sessions/day)

### 5. Input Validation
- **Current**: Basic validation exists
- **Recommendation**: Add audio length limits (max 30 seconds per turn)

## Free Services (No Cost)

1. **TTS (Text-to-Speech)**: Uses browser Web Speech API - **FREE**
2. **Database**: Neon PostgreSQL (likely free tier) - **FREE**
3. **Hosting**: Koyeb (free for 12 months) - **FREE**

## Recommendations

### Immediate Actions
1. **Add rate limiting**: Limit requests per IP/user
2. **Add authentication**: Require login or API key
3. **Monitor costs**: Set up alerts via Student Portal API usage endpoint
4. **Add session limits**: Max sessions per user per day

### Cost Monitoring
```typescript
// Example: Check usage via Student Portal API
const usageResponse = await fetch(
  `${STUDENT_PORTAL_BASE_URL}/v1/usage/summary`,
  {
    headers: { Authorization: `Bearer ${apiKey}` }
  }
);
const usage = await usageResponse.json();
console.log('Lifetime cost:', usage.lifetime_cost_usd);
console.log('Cost ceiling:', usage.cost_ceiling_usd);
```

### Estimated Monthly Costs

**Your Mom's Usage (Primary Use Case):**
- **Usage**: 5 sessions/day × 30 days = 150 sessions/month
- **Session costs**: 150 × $0.025 = **$3.75/month**
- **Daily summaries**: 30 days × $0.05/day = **$1.50/month**
- **Total per month**: **~$5.25/month**
- **For 5 months**: **~$26.25**

**Conservative estimate (family use only):**
- 10 sessions/day × 30 days = 300 sessions
- Cost: 300 × $0.025 = **$7.50/month**

**With random testers (moderate):**
- 50 sessions/day × 30 days = 1,500 sessions
- Cost: 1,500 × $0.025 = **$37.50/month**

**With heavy testing:**
- 200 sessions/day × 30 days = 6,000 sessions
- Cost: 6,000 × $0.025 = **$150/month**

## Your Specific Budget Scenario

**Mom's Usage (5 months):**
- 5 sessions/day × 30 days × 5 months = 750 sessions total
- Session costs: 750 × $0.025 = **$18.75**
- Daily summaries: 150 days × $0.05/day = **$7.50**
- **Total for Mom: ~$26.25 over 5 months**
- **Per month: ~$5.25/month**

**Random Testers Budget:**
- **Budget allocated: $30**

**Total Expected Cost:**
- **Mom (5 months)**: ~$26.25
- **Random testers**: $30.00
- **Grand total**: **~$56.25 over 5 months**
- **Average per month**: **~$11.25/month**

**Budget Summary:**
- ✅ Your $30 budget for random testers is reasonable
- ✅ Mom's usage is very affordable at ~$5/month
- ✅ Total cost is well within reasonable limits

## Important Notes

1. **Actual costs depend on**: Student Portal API pricing, which may differ from OpenAI direct pricing
2. **gpt-5 model pricing**: Unknown - may be more or less expensive than GPT-4
3. **ASR pricing**: Depends on backend provider (Whisper, Azure, etc.)
4. **Cost ceiling**: Check your Student Portal account for any cost limits
5. **Free tier**: May have free tier limits that reduce costs

## Next Steps

1. Check your Student Portal account for:
   - Current usage and costs
   - Cost ceiling settings
   - Rate limits
   - Free tier limits

2. Implement rate limiting and authentication before opening to public

3. Set up cost monitoring alerts

4. Consider adding a "demo mode" with limited functionality for testers

