import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET() {
  const checks = {
    database: 'unknown',
    databaseUrl: process.env.DATABASE_URL ? 'set' : 'missing',
    apiKey: process.env.SUPER_MIND_API_KEY || process.env.AI_BUILDER_TOKEN ? 'set' : 'missing',
  };

  try {
    // Test database connection
    const db = getDbPool();
    await db.query('SELECT 1');
    checks.database = 'connected';
  } catch (error) {
    checks.database = `error: ${error instanceof Error ? error.message : 'unknown'}`;
  }

  return NextResponse.json({
    status: 'ok',
    checks,
    timestamp: new Date().toISOString(),
  });
}

