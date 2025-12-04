-- ============================
-- Households & Users
-- ============================

CREATE TABLE households (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,                         -- e.g. "Cui family"
    timezone     TEXT NOT NULL DEFAULT 'America/New_York',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id   UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    display_name   TEXT NOT NULL,                       -- e.g. "Mom", "Haige", "Husband"
    family_role    TEXT NOT NULL,                       -- e.g. 'mom', 'partner', 'mother_in_law', 'child'
    primary_lang   VARCHAR(16) NOT NULL,                -- BCP-47, e.g. 'zh-CN', 'en-US'
    is_primary     BOOLEAN NOT NULL DEFAULT FALSE,      -- mom could be TRUE
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_household
    ON users (household_id);

-- ============================
-- Conversation Sessions
-- One session = Mom turn + reply turn (for v1)
-- ============================

CREATE TABLE conversation_sessions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id          UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

    started_at            TIMESTAMPTZ NOT NULL,         -- when mom starts speaking
    ended_at              TIMESTAMPTZ,                  -- when reply finishes TTS

    initiated_by_user_id  UUID REFERENCES users(id),    -- usually mom
    context_note          TEXT,                         -- optional free-form note

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_household_started_at
    ON conversation_sessions (household_id, started_at DESC);

-- ============================
-- Conversation Turns
-- Each session has 2 turns in v1:
--   turn_index = 0: mom (zh → en)
--   turn_index = 1: partner reply (en → zh)
-- ============================

CREATE TABLE conversation_turns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id              UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    household_id            UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

    speaker_user_id         UUID REFERENCES users(id),
    speaker_role            TEXT NOT NULL,          -- 'mom', 'partner', etc. (denormalized for easy filtering)
    turn_index              INTEGER NOT NULL,       -- 0, 1 for v1 (can grow later for multi-turn)

    ended_at                TIMESTAMPTZ NOT NULL,   -- when speech ends (used for ordering + daily filters)

    -- Text & language
    source_lang             VARCHAR(16) NOT NULL,   -- e.g. 'zh-CN' or 'en-US'
    target_lang             VARCHAR(16) NOT NULL,   -- e.g. 'en-US' or 'zh-CN'
    source_text             TEXT NOT NULL,          -- ASR transcript from /v1/audio/transcriptions
    translated_text         TEXT NOT NULL,          -- final translation from /v1/chat/completions

    -- Situation tagging (filled by LLM after translation returns)
    situation_tag           TEXT,                   -- e.g. 'kitchen', 'baby', 'postpartum'
    situation_confidence    NUMERIC(3,2),           -- optional, 0.00–1.00 if you choose to store it

    -- Glue back to Student Portal calls (good for debugging)
    asr_request_id          TEXT,                   -- TranscriptionResponse.request_id
    translation_request_id  TEXT,                   -- ChatCompletionResponse.id

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_session_turn UNIQUE (session_id, turn_index)
);

CREATE INDEX idx_turns_session
    ON conversation_turns (session_id, turn_index);

CREATE INDEX idx_turns_household_time
    ON conversation_turns (household_id, ended_at DESC);

CREATE INDEX idx_turns_situation
    ON conversation_turns (household_id, situation_tag);

-- ============================
-- Daily Summaries (Daily Review screen)
-- One per household per local date
-- ============================

CREATE TABLE daily_summaries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id     UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

    summary_date     DATE NOT NULL,          -- local household date (e.g. 2025-12-31)

    -- Short topic summary (bilingual)
    topic_summary_zh TEXT NOT NULL,          -- simple Chinese summary for mom
    topic_summary_en TEXT NOT NULL,          -- simple English summary

    -- "What's New Today" section (bilingual, optional)
    whats_new_zh     TEXT,
    whats_new_en     TEXT,

    generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_daily_summary UNIQUE (household_id, summary_date)
);

CREATE INDEX idx_daily_summaries_household_date
    ON daily_summaries (household_id, summary_date DESC);

-- ============================
-- Daily Key Phrases
-- ~5 useful English phrases per day
-- ============================

CREATE TABLE daily_key_phrases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    summary_id      UUID NOT NULL REFERENCES daily_summaries(id) ON DELETE CASCADE,

    summary_date    DATE NOT NULL,          -- denormalized for convenient queries

    phrase_rank     INTEGER NOT NULL,       -- 1..5 order for the UI
    phrase_en       TEXT NOT NULL,          -- e.g. "Can you hold the baby for a bit?"
    phrase_zh       TEXT NOT NULL,          -- natural Chinese equivalent
    explanation_zh  TEXT,                   -- short explanation in Chinese (optional)
    example_en      TEXT,                   -- optional usage example
    example_zh      TEXT,                   -- optional example in Chinese

    is_new_today    BOOLEAN NOT NULL DEFAULT FALSE, -- whether this is new/rare according to "What's New"

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_daily_phrase UNIQUE (household_id, summary_date, phrase_en)
);

CREATE INDEX idx_daily_phrases_household_date
    ON daily_key_phrases (household_id, summary_date, phrase_rank);
