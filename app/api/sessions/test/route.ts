import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  try {
    const householdId = '00000000-0000-0000-0000-000000000000';
    const userId = '00000000-0000-0000-0000-000000000001';

    // Test 1: Check household
    const household = await queryOne<{ id: string }>(
      `SELECT id FROM households WHERE id = $1`,
      [householdId]
    );

    // Test 2: Check user
    const user = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND household_id = $2`,
      [userId, householdId]
    );

    return NextResponse.json({
      success: true,
      household: household ? 'found' : 'not found',
      user: user ? 'found' : 'not found',
      householdId,
      userId,
    });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

