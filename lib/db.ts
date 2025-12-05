import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// 1. Try to get the URL from the system environment variables (Standard for Production)
let databaseUrl = process.env.DATABASE_URL;

// Debug: Log DATABASE_URL info (mask password for security)
if (databaseUrl) {
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('📊 DATABASE_URL Debug Info:');
  console.log(`  - Source: process.env.DATABASE_URL`);
  console.log(`  - Length: ${databaseUrl.length} characters`);
  console.log(`  - Masked URL: ${maskedUrl}`);
  console.log(`  - Has sslmode: ${databaseUrl.includes('sslmode')}`);
  console.log(`  - Has channel_binding: ${databaseUrl.includes('channel_binding')}`);
  
  // Parse and log connection details (without password)
  try {
    const url = new URL(databaseUrl);
    console.log(`  - Protocol: ${url.protocol}`);
    console.log(`  - Host: ${url.hostname}`);
    console.log(`  - Port: ${url.port || '5432 (default)'}`);
    console.log(`  - Database: ${url.pathname.slice(1)}`);
    console.log(`  - Username: ${url.username}`);
    console.log(`  - Query params: ${url.search}`);
  } catch (e) {
    console.warn('  ⚠️ Could not parse DATABASE_URL as URL');
  }
} else {
  console.warn('⚠️ DATABASE_URL is not set in process.env');
}

// 2. Fallback: Try to read from config.production.json (Optional: for local dev only)
if (!databaseUrl) {
  try {
    const configPath = path.resolve(process.cwd(), 'config.production.json');
    if (fs.existsSync(configPath)) {
      const configFile = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configFile);
      databaseUrl = config.DATABASE_URL;
      console.log('✅ Loaded DATABASE_URL from local config file');
    }
  } catch (error) {
    console.warn('⚠️ Could not read config file, relying strictly on process.env');
  }
}

// 3. Security Check
if (!databaseUrl) {
  console.error('❌ Critical Error: DATABASE_URL is missing.');
  throw new Error('DATABASE_URL is not defined in Environment Variables.');
}

// 4. Create the Pool
// Neon requires SSL connections. We enforce SSL here.
console.log('🔌 Creating PostgreSQL connection pool...');
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false, // Required for many cloud Postgres providers including Neon
  },
});

// Helper function for health checks
export function getDbPool() {
  return pool;
}