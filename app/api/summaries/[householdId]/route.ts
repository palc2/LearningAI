import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { householdId: string } }
) {
  try {
    const householdId = params.householdId;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get household timezone
    const household = await queryOne<{ timezone: string }>(
      `SELECT timezone FROM households WHERE id = $1`,
      [householdId]
    );

    if (!household) {
      return NextResponse.json(
        { error: 'Household not found' },
        { status: 404 }
      );
    }

    // Fetch daily summary
    const summary = await queryOne<{
      id: string;
      summary_date: string;
      topic_summary_zh: string;
      topic_summary_en: string;
      whats_new_zh: string | null;
      whats_new_en: string | null;
      generated_at: Date;
    }>(
      `SELECT id, summary_date, topic_summary_zh, topic_summary_en, 
              whats_new_zh, whats_new_en, generated_at
       FROM daily_summaries
       WHERE household_id = $1 AND summary_date = $2`,
      [householdId, date]
    );

    if (!summary) {
      return NextResponse.json(
        { error: 'Summary not found for this date' },
        { status: 404 }
      );
    }

    // Fetch key phrases
    const phrases = await query<{
      id: string;
      phrase_rank: number;
      phrase_en: string;
      phrase_zh: string;
      explanation_zh: string | null;
      example_en: string | null;
      example_zh: string | null;
      is_new_today: boolean;
    }>(
      `SELECT id, phrase_rank, phrase_en, phrase_zh, explanation_zh,
              example_en, example_zh, is_new_today
       FROM daily_key_phrases
       WHERE household_id = $1 AND summary_date = $2
       ORDER BY phrase_rank ASC`,
      [householdId, date]
    );

    return NextResponse.json({
      summary: {
        id: summary.id,
        summaryDate: summary.summary_date,
        topicSummaryZh: summary.topic_summary_zh,
        topicSummaryEn: summary.topic_summary_en,
        whatsNewZh: summary.whats_new_zh,
        whatsNewEn: summary.whats_new_en,
        generatedAt: summary.generated_at.toISOString(),
      },
      phrases: phrases.map((p) => ({
        id: p.id,
        rank: p.phrase_rank,
        phraseEn: p.phrase_en,
        phraseZh: p.phrase_zh,
        explanationZh: p.explanation_zh,
        exampleEn: p.example_en,
        exampleZh: p.example_zh,
        isNewToday: p.is_new_today,
      })),
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

