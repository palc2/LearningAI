import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDbPool } from '../lib/db';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('✅ Loaded environment variables from .env');
} else {
  console.warn('⚠️  No .env file found. Using system environment variables.');
  config(); // Still try to load from process.env
}

async function migrate() {
  console.log('Starting database migration...');
  
  // Check if DATABASE_URL is set before proceeding
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('   Please create a .env file with DATABASE_URL=postgresql://...');
    console.error('   Or set it as an environment variable:');
    console.error('   Windows: set DATABASE_URL=postgresql://...');
    console.error('   Linux/Mac: export DATABASE_URL=postgresql://...');
    process.exit(1);
  }
  
  const db = getDbPool();
  
  try {
    // Read the schema file
    const schemaPath = join(process.cwd(), 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Execute the schema
    await db.query(schema);
    
    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();

