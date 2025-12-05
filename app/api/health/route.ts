import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    database: 'unknown',
    databaseUrl: process.env.DATABASE_URL ? 'set' : 'missing',
    apiKey: process.env.SUPER_MIND_API_KEY || process.env.AI_BUILDER_TOKEN ? 'set' : 'missing',
  };

  try {
    // Test database connection - but don't fail if it's not available yet
    const { getDbPool } = await import('@/lib/db');
    const db = getDbPool();
    await db.query('SELECT 1');
    checks.database = 'connected';
  } catch (error) {
    // Don't fail health check if DB is unavailable - just report it
    checks.database = `error: ${error instanceof Error ? error.message : 'unknown'}`;
  }

  // Always return 200 OK - health check should pass even if DB is temporarily unavailable
  return NextResponse.json({
    status: 'ok',
    checks,
    timestamp: new Date().toISOString(),
  });
}

