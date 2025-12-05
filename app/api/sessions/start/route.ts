import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { checkRateLimit, RateLimitConfigs } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Check rate limit
  const rateLimitResponse = await checkRateLimit(request, RateLimitConfigs.SESSION_START);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { householdId, initiatedByUserId } = body;

    if (!householdId || !initiatedByUserId) {
      return NextResponse.json(
        { error: 'householdId and initiatedByUserId are required' },
        { status: 400 }
      );
    }

    // Validate UUIDs
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(householdId) || !uuidRegex.test(initiatedByUserId)) {
      return NextResponse.json(
        { error: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    // Verify household exists
    const household = await queryOne<{ id: string }>(
      `SELECT id FROM households WHERE id = $1`,
      [householdId]
    );
    if (!household) {
      return NextResponse.json(
        { error: `Household with id ${householdId} not found. Please run the test data setup script.` },
        { status: 404 }
      );
    }

    // Verify user exists
    const user = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND household_id = $2`,
      [initiatedByUserId, householdId]
    );
    if (!user) {
      return NextResponse.json(
        { error: `User with id ${initiatedByUserId} not found in household ${householdId}. Please run the test data setup script.` },
        { status: 404 }
      );
    }

    // Create session
    const result = await query<{ id: string }>(
      `INSERT INTO conversation_sessions (household_id, initiated_by_user_id, started_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [householdId, initiatedByUserId]
    );

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: result[0].id });
  } catch (error) {
    console.error('Error starting session:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      cause: error instanceof Error ? error.cause : undefined,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.name : 'UnknownError',
      },
      { status: 500 }
    );
  }
}

