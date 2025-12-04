# Family Voice Bridge - Testing Guide

## Prerequisites

1. **Environment Setup**
   ```bash
   # Install dependencies
   npm install
   
   # Ensure your .env file is configured:
   # DATABASE_URL=postgresql://postgres:Family2026@localhost:5432/postgres
   # SUPER_MIND_API_KEY=your_api_key_here
   # STUDENT_PORTAL_URL=https://api.ai-builders.com/backend (optional, has default)
   ```

2. **Database Setup**
   ```bash
   # Run migrations to create tables
   npm run db:migrate
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   # App will be available at http://localhost:3000
   ```

---

## Step 1: Set Up Test Data

Before testing the app, you need to create test data in your database. Run these SQL commands in your PostgreSQL database:

```sql
-- 1. Create a test household
INSERT INTO households (id, name, timezone)
VALUES ('00000000-0000-0000-0000-000000000000', 'Test Family', 'America/New_York')
ON CONFLICT (id) DO NOTHING;

-- 2. Create test users (mom and partner)
INSERT INTO users (id, household_id, display_name, family_role, primary_lang, is_primary)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Mom', 'mom', 'zh-CN', true),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Partner', 'partner', 'en-US', false)
ON CONFLICT (id) DO NOTHING;
```

**Note:** The frontend currently uses these hardcoded UUIDs. In production, you'd use real user authentication.

---

## Step 2: Test Backend API Routes

### 2.1 Test Session Start

```bash
curl -X POST http://localhost:3000/api/sessions/start \
  -H "Content-Type: application/json" \
  -d '{
    "householdId": "00000000-0000-0000-0000-000000000000",
    "initiatedByUserId": "00000000-0000-0000-0000-000000000001"
  }'
```

**Expected Response:**
```json
{
  "sessionId": "some-uuid-here"
}
```

**Save the `sessionId` for next steps!**

### 2.2 Test Mom's Turn (Chinese → English)

You'll need an audio file. Create a test audio file or use a recording:

```bash
# Using curl with a test audio file
curl -X POST http://localhost:3000/api/sessions/[SESSION_ID]/mom-turn \
  -F "file=@test-audio-zh.webm"
```

**Expected Response:**
```json
{
  "sourceText": "中文文本",
  "translatedText": "English translation"
}
```

**Note:** Replace `[SESSION_ID]` with the sessionId from step 2.1.

### 2.3 Test Partner's Turn (English → Chinese)

```bash
curl -X POST http://localhost:3000/api/sessions/[SESSION_ID]/reply-turn \
  -F "file=@test-audio-en.webm"
```

**Expected Response:**
```json
{
  "sourceText": "English text",
  "translatedText": "中文翻译"
}
```

### 2.4 Test Situation Tagging

```bash
curl -X POST http://localhost:3000/api/sessions/[SESSION_ID]/tag
```

**Expected Response:**
```json
{
  "situationTag": "kitchen"
}
```

### 2.5 Test Daily Summary Generation

First, ensure you have some conversation turns for today. Then:

```bash
curl -X POST http://localhost:3000/api/summaries/generate \
  -H "Content-Type: application/json" \
  -d '{
    "householdId": "00000000-0000-0000-0000-000000000000",
    "summaryDate": "2025-01-15"
  }'
```

**Expected Response:**
```json
{
  "summary": {
    "topic_summary_zh": "...",
    "topic_summary_en": "...",
    "phrases": [...]
  },
  "summaryDate": "2025-01-15"
}
```

### 2.6 Test Fetch Daily Summary

```bash
curl http://localhost:3000/api/summaries/00000000-0000-0000-0000-000000000000?date=2025-01-15
```

---

## Step 3: Test Frontend (Browser)

### 3.1 Test Main Conversation Flow

1. **Open Browser:** Navigate to `http://localhost:3000`

2. **Grant Microphone Permission:** When prompted, allow microphone access

3. **Start Session:**
   - Click "Speak Chinese" button
   - Speak in Chinese (or simulate by recording)
   - Click "Stop Recording"

4. **Verify Flow:**
   - ✅ Should show "Processing..." state
   - ✅ Should play English translation via TTS
   - ✅ Should show "Waiting for partner (10s)..." countdown
   - ✅ Should automatically start partner recording

5. **Partner Turn:**
   - Speak in English (or simulate)
   - Click "Stop Recording"
   - ✅ Should play Chinese translation via TTS
   - ✅ Should show "Session Saved!"

### 3.2 Test Daily Review Page

1. **Navigate:** Go to `http://localhost:3000/review`

2. **Verify:**
   - ✅ Date selector is visible
   - ✅ If summary exists, shows bilingual summary
   - ✅ Shows 5 key phrases with play buttons
   - ✅ Play buttons trigger English TTS

3. **Test Date Selection:**
   - Change date to a date with conversations
   - ✅ Should load summary for that date

---

## Step 4: End-to-End Testing Checklist

### ✅ Complete Conversation Flow

- [ ] Start session → Creates session in database
- [ ] Record mom's Chinese → Transcribes → Translates → Saves turn
- [ ] Play English TTS → Audio plays correctly
- [ ] Auto-transition to partner → Countdown works
- [ ] Record partner's English → Transcribes → Translates → Saves turn
- [ ] Play Chinese TTS → Audio plays correctly
- [ ] Tag conversation → Situation tag saved
- [ ] Session marked as ended → `ended_at` updated

### ✅ Daily Summary Flow

- [ ] Generate summary → Creates/updates daily_summaries
- [ ] View review page → Shows summary and phrases
- [ ] Play phrase → TTS works for English phrases

### ✅ Error Handling

- [ ] Invalid session ID → Returns 404
- [ ] Missing audio file → Returns 400
- [ ] Network error → Shows error message
- [ ] API key missing → Server error logged

---

## Step 5: Database Verification

After testing, verify data was saved correctly:

```sql
-- Check sessions
SELECT id, household_id, started_at, ended_at 
FROM conversation_sessions 
ORDER BY started_at DESC 
LIMIT 5;

-- Check turns
SELECT 
  session_id,
  turn_index,
  speaker_role,
  source_lang,
  target_lang,
  source_text,
  translated_text,
  situation_tag,
  asr_request_id,
  translation_request_id
FROM conversation_turns
ORDER BY ended_at DESC
LIMIT 10;

-- Check daily summaries
SELECT 
  summary_date,
  topic_summary_zh,
  topic_summary_en,
  generated_at
FROM daily_summaries
ORDER BY summary_date DESC
LIMIT 5;

-- Check key phrases
SELECT 
  summary_date,
  phrase_rank,
  phrase_en,
  phrase_zh
FROM daily_key_phrases
ORDER BY summary_date DESC, phrase_rank
LIMIT 10;
```

---

## Step 6: Common Issues & Troubleshooting

### Issue: "Failed to access microphone"
**Solution:**
- Ensure HTTPS in production (required for getUserMedia)
- Check browser permissions
- Try different browser (Chrome/Firefox recommended)

### Issue: "SUPER_MIND_API_KEY not set"
**Solution:**
- Check `.env` file exists
- Verify `SUPER_MIND_API_KEY` or `AI_BUILDER_TOKEN` is set
- Restart dev server after changing `.env`

### Issue: "Database connection failed"
**Solution:**
- Verify PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` in `.env`
- Ensure database exists: `psql -U postgres -l`

### Issue: "Session not found"
**Solution:**
- Ensure you're using a valid sessionId
- Check sessions table: `SELECT * FROM conversation_sessions;`

### Issue: "No summary found"
**Solution:**
- Generate summary first: `POST /api/summaries/generate`
- Check date format (YYYY-MM-DD)
- Verify conversations exist for that date

### Issue: TTS not working
**Solution:**
- Check browser console for errors
- Verify language codes: `en-US` for English, `zh-CN` for Chinese
- Test TTS in browser console:
  ```javascript
  const utterance = new SpeechSynthesisUtterance('Hello');
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
  ```

### Issue: Audio recording not working
**Solution:**
- Check browser console for MediaRecorder errors
- Verify audio format support (WebM preferred)
- Test in different browser

---

## Step 7: Automated Testing (Optional)

Create a test script for quick verification:

```bash
# Create test-audio.sh
#!/bin/bash

SESSION_ID=$(curl -s -X POST http://localhost:3000/api/sessions/start \
  -H "Content-Type: application/json" \
  -d '{"householdId":"00000000-0000-0000-0000-000000000000","initiatedByUserId":"00000000-0000-0000-0000-000000000001"}' \
  | jq -r '.sessionId')

echo "Created session: $SESSION_ID"

# Test mom turn (you'll need actual audio files)
# curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/mom-turn -F "file=@test-zh.webm"

echo "Test complete. Session ID: $SESSION_ID"
```

---

## Step 8: Performance Testing

### Test API Response Times

```bash
# Time session start
time curl -X POST http://localhost:3000/api/sessions/start \
  -H "Content-Type: application/json" \
  -d '{"householdId":"00000000-0000-0000-0000-000000000000","initiatedByUserId":"00000000-0000-0000-0000-000000000001"}'

# Time transcription (will be slower due to AI processing)
time curl -X POST http://localhost:3000/api/sessions/[SESSION_ID]/mom-turn \
  -F "file=@test-audio.webm"
```

**Expected:**
- Session start: < 100ms
- Transcription + Translation: 2-5 seconds (depends on audio length and AI API)

---

## Quick Test Script

Save this as `quick-test.js`:

```javascript
// Quick API test script
const BASE_URL = 'http://localhost:3000';
const HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000000';
const USER_ID = '00000000-0000-0000-0000-000000000001';

async function test() {
  try {
    // 1. Start session
    const sessionRes = await fetch(`${BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId: HOUSEHOLD_ID, initiatedByUserId: USER_ID }),
    });
    const { sessionId } = await sessionRes.json();
    console.log('✅ Session started:', sessionId);

    // 2. Check summary endpoint (may fail if no data)
    const summaryRes = await fetch(`${BASE_URL}/api/summaries/${HOUSEHOLD_ID}?date=${new Date().toISOString().split('T')[0]}`);
    if (summaryRes.ok) {
      console.log('✅ Summary endpoint works');
    } else {
      console.log('ℹ️  No summary yet (this is OK)');
    }

    console.log('\n✅ Basic API tests passed!');
    console.log(`\nNext: Test with audio files using sessionId: ${sessionId}`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

test();
```

Run with: `node quick-test.js` (or use `tsx quick-test.js`)

---

## Success Criteria

Your app is working correctly if:

1. ✅ Sessions can be created
2. ✅ Audio can be recorded and transcribed
3. ✅ Translations are accurate and saved
4. ✅ TTS plays in correct languages
5. ✅ Daily summaries can be generated
6. ✅ Review page displays summaries and phrases
7. ✅ All data persists in database

---

## Next Steps After Testing

1. **Fix any bugs** found during testing
2. **Add error boundaries** for better error handling
3. **Implement user authentication** (replace hardcoded UUIDs)
4. **Add loading states** and better UX feedback
5. **Deploy** when ready!

Good luck with testing! 🚀

