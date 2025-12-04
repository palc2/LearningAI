-- Check recent conversation sessions and turns
-- Run this to see what's stored in the database

-- Get recent sessions
SELECT 
    s.id as session_id,
    s.started_at,
    s.ended_at,
    h.name as household_name,
    u.display_name as initiated_by
FROM conversation_sessions s
JOIN households h ON s.household_id = h.id
LEFT JOIN users u ON s.initiated_by_user_id = u.id
ORDER BY s.started_at DESC
LIMIT 10;

-- Get turns for recent sessions
SELECT 
    t.id as turn_id,
    t.session_id,
    t.turn_index,
    t.speaker_role,
    t.source_lang,
    t.target_lang,
    LEFT(t.source_text, 50) as source_text_preview,
    LEFT(t.translated_text, 50) as translated_text_preview,
    t.situation_tag,
    t.ended_at,
    t.asr_request_id,
    t.translation_request_id
FROM conversation_turns t
ORDER BY t.ended_at DESC
LIMIT 20;

-- Check for turns with empty translated_text
SELECT 
    t.id,
    t.session_id,
    t.turn_index,
    t.speaker_role,
    t.source_text,
    t.translated_text,
    LENGTH(t.translated_text) as translated_text_length,
    t.translation_request_id,
    t.ended_at
FROM conversation_turns t
WHERE t.translated_text IS NULL OR t.translated_text = ''
ORDER BY t.ended_at DESC;

