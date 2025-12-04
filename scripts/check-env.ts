import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load .env file
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('✅ Found .env file');
} else {
  console.log('❌ No .env file found');
  console.log('   Please create a .env file with:');
  console.log('   DATABASE_URL=postgresql://user:password@localhost:5432/dbname');
  console.log('   SUPER_MIND_API_KEY=your_key_here');
  process.exit(1);
}

// Check required variables
const checks = {
  DATABASE_URL: !!process.env.DATABASE_URL,
  SUPER_MIND_API_KEY: !!(process.env.SUPER_MIND_API_KEY || process.env.AI_BUILDER_TOKEN),
  STUDENT_PORTAL_URL: process.env.STUDENT_PORTAL_URL || 'using default',
};

console.log('\n📋 Environment Variables Check:');
console.log('─────────────────────────────────');
Object.entries(checks).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  console.log(`${status} ${key}: ${value === true ? 'set' : value === false ? 'missing' : value}`);
});

if (!checks.DATABASE_URL) {
  console.log('\n❌ DATABASE_URL is required!');
  process.exit(1);
}

if (!checks.SUPER_MIND_API_KEY) {
  console.log('\n⚠️  SUPER_MIND_API_KEY is missing (needed for AI features)');
}

console.log('\n✅ Environment check complete!');

