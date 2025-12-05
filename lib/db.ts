import { Pool } from 'pg';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Create a singleton PostgreSQL connection pool
let pool: Pool | null = null;

/**
 * Get DATABASE_URL from environment variable or fallback to config file
 * This allows the app to work in production when env vars aren't set by the platform
 */
function getDatabaseUrl(): string {
  // First, try environment variable (preferred method)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Fallback: Try to read from config.production.json (for deployment platforms that don't set env vars)
  const configPath = join(process.cwd(), 'config.production.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (config.DATABASE_URL) {
        console.log('📋 Loaded DATABASE_URL from config.production.json');
        return config.DATABASE_URL;
      }
    } catch (error) {
      console.warn('⚠️  Failed to read config.production.json:', error);
    }
  }
  
  throw new Error('DATABASE_URL environment variable is not set and config.production.json not found');
}

export function getDbPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();

    pool = new Pool({
      connectionString,
      // Connection pool configuration
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

// Helper function to execute queries
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  try {
    const db = getDbPool();
    const result = await db.query(text, params);
    return result.rows;
  } catch (error) {
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('DATABASE_URL')) {
        throw new Error('Database not configured. Please set DATABASE_URL in your .env file.');
      }
      if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Cannot connect to database. Please check your DATABASE_URL and ensure PostgreSQL is running.');
      }
    }
    throw error;
  }
}

// Helper function to execute a single row query
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

// Helper function for transactions
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const db = getDbPool();
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

