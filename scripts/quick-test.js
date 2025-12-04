/**
 * Quick API Test Script
 * Run with: node scripts/quick-test.js (or tsx scripts/quick-test.js)
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000000';
const USER_ID = '00000000-0000-0000-0000-000000000001';

async function test() {
  console.log('🧪 Starting API tests...\n');

  try {
    // 1. Test session start
    console.log('1. Testing session start...');
    const sessionRes = await fetch(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        householdId: HOUSEHOLD_ID, 
        initiatedByUserId: USER_ID 
      }),
    });

    if (!sessionRes.ok) {
      const error = await sessionRes.text();
      throw new Error(`Session start failed: ${sessionRes.status} - ${error}`);
    }

    const { sessionId } = await sessionRes.json();
    console.log(`   ✅ Session started: ${sessionId}\n`);

    // 2. Test summary endpoint (may fail if no data - that's OK)
    console.log('2. Testing summary endpoint...');
    const today = new Date().toISOString().split('T')[0];
    const summaryRes = await fetch(
      `${BASE_URL}/api/summaries/${HOUSEHOLD_ID}?date=${today}`
    );

    if (summaryRes.ok) {
      const data = await summaryRes.json();
      console.log(`   ✅ Summary found (${data.phrases.length} phrases)`);
    } else if (summaryRes.status === 404) {
      console.log('   ℹ️  No summary yet (this is OK - generate one first)');
    } else {
      console.log(`   ⚠️  Unexpected status: ${summaryRes.status}`);
    }

    console.log('\n✅ Basic API tests passed!');
    console.log(`\n📝 Next steps:`);
    console.log(`   - Test audio recording in browser: ${BASE_URL}`);
    console.log(`   - Use sessionId ${sessionId} for testing mom-turn and reply-turn`);
    console.log(`   - Generate a summary: POST /api/summaries/generate`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   - Is the dev server running? (npm run dev)');
    console.error('   - Is DATABASE_URL set correctly in .env?');
    console.error('   - Have you run: npm run db:migrate?');
    console.error('   - Have you created test data? (see scripts/setup-test-data.sql)');
    process.exit(1);
  }
}

test();

