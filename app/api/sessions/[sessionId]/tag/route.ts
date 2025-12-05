import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { tagConversation } from '@/lib/ai-client';
import { checkRateLimit, RateLimitConfigs } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  // Check rate limit
  const rateLimitResponse = await checkRateLimit(request, RateLimitConfigs.TAGGING);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const sessionId = params.sessionId;

    // Validate session exists
    const session = await queryOne<{ id: string }>(
      `SELECT id FROM conversation_sessions WHERE id = $1`,
      [sessionId]
    );

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch both turns
    const turns = await query<{
      source_text: string;
      translated_text: string;
    }>(
      `SELECT source_text, translated_text 
       FROM conversation_turns 
       WHERE session_id = $1 
       ORDER BY turn_index ASC`,
      [sessionId]
    );

    if (turns.length === 0) {
      return NextResponse.json(
        { error: 'No conversation turns found' },
        { status: 404 }
      );
    }

    // Prepare turns for tagging
    const turnsForTagging = turns.map((turn) => ({
      sourceText: turn.source_text,
      translatedText: turn.translated_text,
    }));

    // Call AI to tag the conversation
    const tagResult = await tagConversation(turnsForTagging);

    // Update all turns with the situation tag
    await query(
      `UPDATE conversation_turns 
       SET situation_tag = $1, updated_at = NOW() 
       WHERE session_id = $2`,
      [tagResult.situationTag, sessionId]
    );

    return NextResponse.json({
      situationTag: tagResult.situationTag,
    });
  } catch (error) {
    console.error('Error tagging conversation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

