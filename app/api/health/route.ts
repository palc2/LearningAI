import { NextResponse } from 'next/server';

export async function GET() {
  // Debug: Log ALL environment variables (masking sensitive ones)
  const allEnvVars: Record<string, string> = {};
  Object.keys(process.env).forEach(key => {
    const value = process.env[key];
    if (key.includes('PASSWORD') || key.includes('SECRET') || key.includes('TOKEN') || key.includes('KEY')) {
      allEnvVars[key] = value ? `${value.substring(0, 4)}****` : 'undefined';
    } else if (key === 'DATABASE_URL') {
      allEnvVars[key] = value ? value.replace(/:([^:@]+)@/, ':****@') : 'undefined';
    } else {
      allEnvVars[key] = value || 'undefined';
    }
  });

  // Mask password in DATABASE_URL for security
  const dbUrl = process.env.DATABASE_URL;
  const maskedDbUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ':****@') : null;
  
  // Parse DATABASE_URL to show connection details
  let dbDetails: any = null;
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      dbDetails = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || '5432 (default)',
        database: url.pathname.slice(1),
        username: url.username,
        hasPassword: !!url.password,
        queryParams: url.search,
        fullMaskedUrl: maskedDbUrl,
        length: dbUrl.length,
      };
    } catch (e) {
      dbDetails = { error: 'Could not parse DATABASE_URL' };
    }
  }

  const checks = {
    database: 'unknown',
    databaseUrl: dbUrl ? 'set' : 'missing',
    databaseUrlDetails: dbDetails,
    apiKey: process.env.SUPER_MIND_API_KEY || process.env.AI_BUILDER_TOKEN ? 'set' : 'missing',
    // Debug: Show all environment variables to diagnose the issue
    allEnvironmentVariables: allEnvVars,
    nodeEnv: process.env.NODE_ENV || 'undefined',
    port: process.env.PORT || 'undefined',
  };

  try {
    // Test database connection - but don't fail if it's not available yet
    const { getDbPool } = await import('@/lib/db');
    const db = getDbPool();
    await db.query('SELECT 1');
    checks.database = 'connected';
  } catch (error) {
    // Don't fail health check if DB is unavailable - just report it
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    checks.database = `error: ${errorMessage}`;
    
    // Add more details about the error
    if (error instanceof Error) {
      (checks as any).databaseErrorDetails = {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }
  }

  // Always return 200 OK - health check should pass even if DB is temporarily unavailable
  return NextResponse.json({
    status: 'ok',
    checks,
    timestamp: new Date().toISOString(),
  });
}

