import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db';
import { generateDailySummary } from '@/lib/ai-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { householdId, summaryDate } = body;

    if (!householdId) {
      return NextResponse.json(
        { error: 'householdId is required' },
        { status: 400 }
      );
    }

    // Use provided date or default to today (in household timezone)
    const targetDate = summaryDate || new Date().toISOString().split('T')[0];

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

    // Fetch all turns for the date (in household timezone)
    // Note: This is a simplified query - in production, you'd want to properly
    // convert timestamps to the household timezone
    const turns = await query<{
      source_text: string;
      translated_text: string;
      source_lang: string;
      target_lang: string;
      ended_at: Date;
    }>(
      `SELECT source_text, translated_text, source_lang, target_lang, ended_at
       FROM conversation_turns
       WHERE household_id = $1
       AND DATE(ended_at AT TIME ZONE $2) = $3
       ORDER BY ended_at ASC`,
      [householdId, household.timezone, targetDate]
    );

    if (turns.length === 0) {
      return NextResponse.json(
        { error: 'No conversations found for the specified date' },
        { status: 404 }
      );
    }

    // Prepare turns for summary generation
    const turnsForSummary = turns.map((turn) => ({
      sourceText: turn.source_text,
      translatedText: turn.translated_text,
      sourceLang: turn.source_lang,
      targetLang: turn.target_lang,
      endedAt: turn.ended_at,
    }));

    // Generate summary using AI
    const summaryResult = await generateDailySummary(turnsForSummary);

    // Upsert daily summary and phrases in a transaction
    await transaction(async (client) => {
      // Upsert daily_summaries
      const summaryUpsert = await client.query<{ id: string }>(
        `INSERT INTO daily_summaries (
          household_id,
          summary_date,
          topic_summary_zh,
          topic_summary_en,
          whats_new_zh,
          whats_new_en,
          generated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (household_id, summary_date)
        DO UPDATE SET
          topic_summary_zh = EXCLUDED.topic_summary_zh,
          topic_summary_en = EXCLUDED.topic_summary_en,
          whats_new_zh = EXCLUDED.whats_new_zh,
          whats_new_en = EXCLUDED.whats_new_en,
          generated_at = NOW()
        RETURNING id`,
        [
          householdId,
          targetDate,
          summaryResult.summary.topic_summary_zh,
          summaryResult.summary.topic_summary_en,
          summaryResult.summary.whats_new_zh || null,
          summaryResult.summary.whats_new_en || null,
        ]
      );

      const summaryId = summaryUpsert.rows[0].id;

      // Delete existing phrases for this date
      await client.query(
        `DELETE FROM daily_key_phrases 
         WHERE household_id = $1 AND summary_date = $2`,
        [householdId, targetDate]
      );

      // Insert new phrases
      for (let i = 0; i < summaryResult.summary.phrases.length; i++) {
        const phrase = summaryResult.summary.phrases[i];
        await client.query(
          `INSERT INTO daily_key_phrases (
            household_id,
            summary_id,
            summary_date,
            phrase_rank,
            phrase_en,
            phrase_zh,
            explanation_zh,
            example_en,
            example_zh,
            is_new_today
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (household_id, summary_date, phrase_en)
          DO UPDATE SET
            phrase_rank = EXCLUDED.phrase_rank,
            phrase_zh = EXCLUDED.phrase_zh,
            explanation_zh = EXCLUDED.explanation_zh,
            example_en = EXCLUDED.example_en,
            example_zh = EXCLUDED.example_zh,
            is_new_today = EXCLUDED.is_new_today`,
          [
            householdId,
            summaryId,
            targetDate,
            i + 1,
            phrase.phrase_en,
            phrase.phrase_zh,
            phrase.explanation_zh || null,
            phrase.example_en || null,
            phrase.example_zh || null,
            false, // is_new_today - could be enhanced to detect new phrases
          ]
        );
      }
    });

    return NextResponse.json({
      summary: summaryResult.summary,
      summaryDate: targetDate,
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific error types
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        statusCode = 504; // Gateway Timeout
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        statusCode = 502; // Bad Gateway
      } else if (error.message.includes('API key') || error.message.includes('environment variable')) {
        statusCode = 500;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

