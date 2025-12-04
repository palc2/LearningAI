import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Debug endpoint to inspect recent sessions and turns
 * GET /api/debug/sessions?limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Get recent sessions
    const sessions = await query<{
      id: string;
      started_at: Date;
      ended_at: Date | null;
      household_name: string;
      initiated_by: string;
    }>(
      `SELECT 
        s.id,
        s.started_at,
        s.ended_at,
        h.name as household_name,
        u.display_name as initiated_by
      FROM conversation_sessions s
      JOIN households h ON s.household_id = h.id
      LEFT JOIN users u ON s.initiated_by_user_id = u.id
      ORDER BY s.started_at DESC
      LIMIT $1`,
      [limit]
    );

    // Get turns for these sessions
    const sessionIds = sessions.map(s => s.id);
    const turns = sessionIds.length > 0 ? await query<{
      id: string;
      session_id: string;
      turn_index: number;
      speaker_role: string;
      source_lang: string;
      target_lang: string;
      source_text: string;
      translated_text: string;
      source_text_length: number;
      translated_text_length: number;
      situation_tag: string | null;
      ended_at: Date;
      asr_request_id: string | null;
      translation_request_id: string | null;
    }>(
      `SELECT 
        t.id,
        t.session_id,
        t.turn_index,
        t.speaker_role,
        t.source_lang,
        t.target_lang,
        t.source_text,
        t.translated_text,
        LENGTH(t.source_text) as source_text_length,
        LENGTH(t.translated_text) as translated_text_length,
        t.situation_tag,
        t.ended_at,
        t.asr_request_id,
        t.translation_request_id
      FROM conversation_turns t
      WHERE t.session_id = ANY($1::uuid[])
      ORDER BY t.ended_at DESC`,
      [sessionIds]
    ) : [];

    // Find problematic turns (empty translated_text)
    const problematicTurns = turns.filter(
      t => !t.translated_text || t.translated_text.trim().length === 0
    );

    return NextResponse.json({
      summary: {
        totalSessions: sessions.length,
        totalTurns: turns.length,
        problematicTurns: problematicTurns.length,
      },
      sessions: sessions.map(s => ({
        ...s,
        started_at: s.started_at.toISOString(),
        ended_at: s.ended_at?.toISOString() || null,
      })),
      turns: turns.map(t => ({
        ...t,
        ended_at: t.ended_at.toISOString(),
        source_text_preview: t.source_text?.substring(0, 100) || '',
        translated_text_preview: t.translated_text?.substring(0, 100) || '',
      })),
      problematicTurns: problematicTurns.map(t => ({
        ...t,
        ended_at: t.ended_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching debug data:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

