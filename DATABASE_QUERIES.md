# Database Query Guide

This guide shows you how to query all the database tables we created for the Family Voice Bridge app.

## Database Tables Overview

1. **households** - Family/household information
2. **users** - Family members (mom, partner, etc.)
3. **conversation_sessions** - Conversation sessions (mom turn + partner reply)
4. **conversation_turns** - Individual conversation turns with translations
5. **daily_summaries** - Daily conversation summaries
6. **daily_key_phrases** - Key phrases extracted from daily conversations

---

## Method 1: Using SQL Directly (psql or pgAdmin)

### Connect to Database
```bash
# Using psql command line
psql $DATABASE_URL

# Or if DATABASE_URL is not set, use:
psql -h localhost -U your_username -d your_database_name
```

### 1. Query Recent Conversation Sessions

```sql
-- Get recent sessions with household and user info
SELECT 
    s.id as session_id,
    s.started_at,
    s.ended_at,
    s.context_note,
    h.name as household_name,
    u.display_name as initiated_by,
    u.family_role as initiated_by_role,
    EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) as duration_seconds
FROM conversation_sessions s
JOIN households h ON s.household_id = h.id
LEFT JOIN users u ON s.initiated_by_user_id = u.id
ORDER BY s.started_at DESC
LIMIT 20;
```

### 2. Query Conversation Turns (Full Details)

```sql
-- Get all turns with full text and metadata
SELECT 
    t.id as turn_id,
    t.session_id,
    t.turn_index,
    t.speaker_role,
    t.source_lang,
    t.target_lang,
    t.source_text,
    t.translated_text,
    LENGTH(t.source_text) as source_text_length,
    LENGTH(t.translated_text) as translated_text_length,
    t.situation_tag,
    t.situation_confidence,
    t.asr_request_id,
    t.translation_request_id,
    t.ended_at,
    t.created_at
FROM conversation_turns t
ORDER BY t.ended_at DESC
LIMIT 50;
```

### 3. Query Complete Conversation (Session + Both Turns)

```sql
-- Get a full conversation with both turns
SELECT 
    s.id as session_id,
    s.started_at,
    s.ended_at,
    h.name as household_name,
    -- Mom's turn (turn_index = 0)
    t0.source_text as mom_source_text,
    t0.translated_text as mom_translated_text,
    t0.ended_at as mom_ended_at,
    -- Partner's turn (turn_index = 1)
    t1.source_text as partner_source_text,
    t1.translated_text as partner_translated_text,
    t1.ended_at as partner_ended_at,
    -- Session duration
    EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) as total_duration_seconds
FROM conversation_sessions s
JOIN households h ON s.household_id = h.id
LEFT JOIN conversation_turns t0 ON s.id = t0.session_id AND t0.turn_index = 0
LEFT JOIN conversation_turns t1 ON s.id = t1.session_id AND t1.turn_index = 1
WHERE s.ended_at IS NOT NULL  -- Only completed sessions
ORDER BY s.started_at DESC
LIMIT 20;
```

### 4. Query by Situation Tag

```sql
-- Find conversations by situation tag
SELECT 
    t.situation_tag,
    COUNT(*) as conversation_count,
    COUNT(DISTINCT t.session_id) as session_count
FROM conversation_turns t
WHERE t.situation_tag IS NOT NULL
GROUP BY t.situation_tag
ORDER BY conversation_count DESC;
```

### 5. Query Daily Summaries

```sql
-- Get daily summaries with key phrases
SELECT 
    ds.id,
    ds.household_id,
    h.name as household_name,
    ds.summary_date,
    ds.topic_summary_zh,
    ds.topic_summary_en,
    ds.whats_new_zh,
    ds.whats_new_en,
    ds.generated_at,
    COUNT(dkp.id) as phrase_count
FROM daily_summaries ds
JOIN households h ON ds.household_id = h.id
LEFT JOIN daily_key_phrases dkp ON ds.id = dkp.summary_id
GROUP BY ds.id, ds.household_id, h.name, ds.summary_date, 
         ds.topic_summary_zh, ds.topic_summary_en, 
         ds.whats_new_zh, ds.whats_new_en, ds.generated_at
ORDER BY ds.summary_date DESC
LIMIT 10;
```

### 6. Query Daily Key Phrases

```sql
-- Get key phrases for a specific date
SELECT 
    dkp.id,
    dkp.summary_date,
    dkp.phrase_rank,
    dkp.phrase_en,
    dkp.phrase_zh,
    dkp.explanation_zh,
    dkp.example_en,
    dkp.example_zh,
    dkp.is_new_today
FROM daily_key_phrases dkp
WHERE dkp.household_id = '00000000-0000-0000-0000-000000000000'  -- Replace with your household_id
  AND dkp.summary_date = CURRENT_DATE  -- Or specific date: '2024-12-02'
ORDER BY dkp.phrase_rank;
```

### 7. Query Statistics/Analytics

```sql
-- Get conversation statistics
SELECT 
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT t.id) as total_turns,
    COUNT(DISTINCT t.session_id) as completed_sessions,
    AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at))) as avg_session_duration_seconds,
    MIN(s.started_at) as first_conversation,
    MAX(s.started_at) as last_conversation
FROM conversation_sessions s
LEFT JOIN conversation_turns t ON s.id = t.session_id
WHERE s.household_id = '00000000-0000-0000-0000-000000000000';  -- Replace with your household_id
```

### 8. Find Problematic Turns (Empty Translations)

```sql
-- Find turns with empty or missing translations (for debugging)
SELECT 
    t.id,
    t.session_id,
    t.turn_index,
    t.speaker_role,
    t.source_text,
    t.translated_text,
    LENGTH(t.translated_text) as translated_text_length,
    t.translation_request_id,
    t.asr_request_id,
    t.ended_at
FROM conversation_turns t
WHERE t.translated_text IS NULL 
   OR t.translated_text = ''
   OR LENGTH(TRIM(t.translated_text)) = 0
ORDER BY t.ended_at DESC;
```

### 9. Query by Date Range

```sql
-- Get conversations from a specific date range
SELECT 
    s.id as session_id,
    s.started_at,
    s.ended_at,
    COUNT(t.id) as turn_count
FROM conversation_sessions s
LEFT JOIN conversation_turns t ON s.id = t.session_id
WHERE s.started_at >= '2024-12-01'::date
  AND s.started_at < '2024-12-03'::date
GROUP BY s.id, s.started_at, s.ended_at
ORDER BY s.started_at DESC;
```

### 10. Query Users and Households

```sql
-- Get all users in a household
SELECT 
    u.id,
    u.display_name,
    u.family_role,
    u.primary_lang,
    u.is_primary,
    h.name as household_name,
    h.timezone
FROM users u
JOIN households h ON u.household_id = h.id
WHERE h.id = '00000000-0000-0000-0000-000000000000'  -- Replace with your household_id
ORDER BY u.created_at;
```

---

## Method 2: Using TypeScript/Next.js Helper Functions

### In Your Code (API Routes or Server Components)

```typescript
import { query, queryOne } from '@/lib/db';

// Example 1: Get recent sessions
const sessions = await query<{
  id: string;
  started_at: Date;
  ended_at: Date | null;
  household_name: string;
  initiated_by: string;
}>(
  `SELECT 
    s.id,
    s.started_at,
    s.ended_at,
    h.name as household_name,
    u.display_name as initiated_by
  FROM conversation_sessions s
  JOIN households h ON s.household_id = h.id
  LEFT JOIN users u ON s.initiated_by_user_id = u.id
  ORDER BY s.started_at DESC
  LIMIT $1`,
  [10]
);

// Example 2: Get turns for a specific session
const turns = await query<{
  id: string;
  turn_index: number;
  speaker_role: string;
  source_text: string;
  translated_text: string;
  situation_tag: string | null;
}>(
  `SELECT 
    id,
    turn_index,
    speaker_role,
    source_text,
    translated_text,
    situation_tag
  FROM conversation_turns
  WHERE session_id = $1
  ORDER BY turn_index`,
  [sessionId]
);

// Example 3: Get a single session
const session = await queryOne<{
  id: string;
  started_at: Date;
  ended_at: Date | null;
}>(
  `SELECT id, started_at, ended_at
   FROM conversation_sessions
   WHERE id = $1`,
  [sessionId]
);
```

---

## Method 3: Using the Debug API Endpoint

We have a built-in debug endpoint you can use:

```bash
# Get recent sessions and turns
curl http://localhost:3002/api/debug/sessions?limit=10

# Or in browser:
http://localhost:3002/api/debug/sessions?limit=10
```

This returns JSON with:
- Summary statistics
- Recent sessions
- All turns for those sessions
- Problematic turns (empty translations)

---

## Method 4: Using a SQL Script File

We have a pre-made script: `scripts/check-sessions.sql`

Run it with:
```bash
psql $DATABASE_URL -f scripts/check-sessions.sql
```

Or copy the queries from that file into your SQL client.

---

## Common Query Patterns

### Pattern 1: Get Latest Conversation
```sql
SELECT * FROM conversation_sessions 
WHERE household_id = 'YOUR_HOUSEHOLD_ID'
ORDER BY started_at DESC 
LIMIT 1;
```

### Pattern 2: Count Conversations Today
```sql
SELECT COUNT(*) 
FROM conversation_sessions 
WHERE household_id = 'YOUR_HOUSEHOLD_ID'
  AND DATE(started_at) = CURRENT_DATE;
```

### Pattern 3: Get All Turns for Latest Session
```sql
SELECT t.* 
FROM conversation_turns t
JOIN conversation_sessions s ON t.session_id = s.id
WHERE s.household_id = 'YOUR_HOUSEHOLD_ID'
ORDER BY s.started_at DESC, t.turn_index
LIMIT 2;
```

### Pattern 4: Find Most Common Situation Tags
```sql
SELECT situation_tag, COUNT(*) as count
FROM conversation_turns
WHERE situation_tag IS NOT NULL
GROUP BY situation_tag
ORDER BY count DESC;
```

---

## Tips

1. **Replace UUIDs**: Replace `'00000000-0000-0000-0000-000000000000'` with your actual `household_id`
2. **Use Indexes**: The queries above use the indexes we created, so they should be fast
3. **Date Filtering**: Use `DATE()` function for date comparisons, or `TIMESTAMPTZ` for precise time ranges
4. **Text Search**: Use `LIKE` or `ILIKE` for text searches:
   ```sql
   SELECT * FROM conversation_turns 
   WHERE source_text ILIKE '%keyword%';
   ```

---

## Quick Reference: Table Relationships

```
households (1) ──< (many) users
households (1) ──< (many) conversation_sessions
households (1) ──< (many) conversation_turns
households (1) ──< (many) daily_summaries

conversation_sessions (1) ──< (many) conversation_turns
daily_summaries (1) ──< (many) daily_key_phrases

users (1) ──< (many) conversation_sessions (initiated_by_user_id)
users (1) ──< (many) conversation_turns (speaker_user_id)
```

---

## Environment Variables

Make sure your `.env` file has:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

Then you can use the TypeScript helper functions, or connect directly with `psql $DATABASE_URL`.

