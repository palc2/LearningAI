# Family Voice Bridge – Cursor Instructions

## 0. Role & Context

You are an expert Full-Stack Developer working in a Cursor agentic workflow. You are building **Family Voice Bridge**, a mobile-first web app facilitating bilingual communication between a Chinese-speaking mother and an English-speaking household.

**Key Constraints:**
1.  **Backend:** You must use the **Student Portal API** (defined in `openapi.json`) for all AI operations (ASR, Translation, Summary) and for **Deployment**.
2.  **Database:** You must strictly follow the schema provided in Section 3.
3.  **UX:** The app is a "Two-Turn" interaction model (Mom speaks $\to$ Translate $\to$ Partner speaks $\to$ Translate).

---

## 1. Architecture & Tech Stack

### Frontend
- **Framework:** Next.js (App Router) + TypeScript.
- **UI:** Tailwind CSS (Mobile-first, large buttons, high contrast).
- **Audio:** `navigator.mediaDevices.getUserMedia` + `MediaRecorder`.
- **TTS:** Web Speech API (`window.speechSynthesis`).

### Backend
- **Framework:** Next.js API Routes (Serverless functions).
- **Database:** PostgreSQL (use `pg` or `postgres.js`).
- **AI Proxy:** All AI requests go to the Student Portal URL defined in `openapi.json`.

---

## 2. External API Integration (Student Portal)

You will consume the `openapi.json` endpoints. Base URL is provided by the environment.

| Feature | Endpoint | Model / Config |
| :--- | :--- | :--- |
| **ASR (Speech-to-Text)** | `POST /v1/audio/transcriptions` | `audio_file` (binary), `language` ("zh" or "en") |
| **Translation** | `POST /v1/chat/completions` | Model: `gpt-5` or `gemini-2.5-pro`. Temp: 0.3 |
| **Summaries** | `POST /v1/chat/completions` | Model: `gpt-5`. Temp: 0.7 |
| **Deployment** | `POST /v1/deployments` | See Section 7 for deployment logic |

---

## 3. Database Schema (Source of Truth)

Create a `schema.sql` file. This is the strict requirement for data persistence.

```sql
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
```

---

## 4. Internal API Specification

Implement these local API routes in Next.js to serve the frontend.

### 4.1 Start Session
**POST** `/api/sessions/start`
* **Body:** `{ householdId: string, initiatedByUserId: string }`
* **Action:** Creates a row in `conversation_sessions`.
* **Returns:** `{ sessionId: string }`

### 4.2 Mom's Turn (Chinese $\to$ English)
**POST** `/api/sessions/[sessionId]/mom-turn`
* **Body:** `FormData` containing `file` (audio blob).
* **Process:**
    1.  Send audio to `POST /v1/audio/transcriptions` (Language: `zh` or `zh-CN`).
    2.  Send transcript to `POST /v1/chat/completions`.
        * *System Prompt:* "You are a precise translator from Chinese to natural spoken English. Keep responses short and conversational. Do not add explanations."
    3.  Save to `conversation_turns` (index: 0, role: 'mom', source: 'zh-CN', target: 'en-US').
* **Returns:** `{ sourceText: string, translatedText: string }`
* **Frontend Action:** Plays `translatedText` using English TTS.

### 4.3 Partner's Turn (English $\to$ Chinese)
**POST** `/api/sessions/[sessionId]/reply-turn`
* **Body:** `FormData` containing `file` (audio blob).
* **Process:**
    1.  Send audio to `POST /v1/audio/transcriptions` (Language: `en` or `en-US`).
    2.  Send transcript to `POST /v1/chat/completions`.
        * *System Prompt:* "You are a precise translator from English to natural, simple spoken Chinese. Use vocabulary appropriate for a 60-year-old Chinese learner. Do not add explanations."
    3.  Save to `conversation_turns` (index: 1, role: 'partner', source: 'en-US', target: 'zh-CN').
    4.  Update `conversation_sessions` with `ended_at`.
* **Returns:** `{ sourceText: string, translatedText: string }`
* **Frontend Action:** Plays `translatedText` using Chinese TTS.

### 4.4 Async Situation Tagging
**POST** `/api/sessions/[sessionId]/tag` (Or trigger internally after Turn 2)
* **Process:**
    1.  Fetch both turns.
    2.  Call `POST /v1/chat/completions`.
    3.  *Prompt:* "Analyze this conversation. Return a JSON object with a single key 'situation_tag' (e.g., 'kitchen', 'baby', 'food')."
    4.  Update `conversation_turns` with the tag.

### 4.5 Daily Summary
**POST** `/api/summaries/generate`
* **Process:**
    1.  Fetch all turns for the date.
    2.  Call `POST /v1/chat/completions`.
    3.  *Prompt:* "Summarize these conversations. Return JSON with fields: topic_summary_zh, topic_summary_en, whats_new_zh, whats_new_en, and an array of 5 phrases (phrase_en, phrase_zh, explanation_zh)."
    4.  Upsert to `daily_summaries` and `daily_key_phrases`.

---

## 5. Frontend & UX Specifications

### 5.1 Main Screen (The "Big Button")
1.  **Idle State:** Large "Speak Chinese" button.
2.  **Mom Recording:** Visual feedback (waveform or pulsing green).
3.  **Processing:** Spinner/Loading state.
4.  **Playback (English):** Auto-play TTS.
5.  **Auto-Transition:** Immediately after English TTS finishes, enter **Partner Recording** mode (count down 10s or wait for silence).
6.  **Partner Recording:** Visual feedback.
7.  **Playback (Chinese):** Auto-play TTS.
8.  **Done:** Show "Session Saved" and reset.

### 5.2 Daily Review
1.  List 5 Key Phrases (Ranked).
2.  Each phrase has a "Play" button (English TTS).
3.  Show the bilingual summary and "What's New".

---

## 6. Development Workflow (Step-by-Step)

1.  **Setup:** Initialize Next.js project. Configure `pg` client.
2.  **Schema:** Run the `schema.sql` to set up tables.
3.  **Backend Logic:** Implement the API routes defined in Section 4. Ensure `FormData` parsing works for audio uploads.
4.  **AI Integration:** Create a utility helper `ai-client.ts` that wraps the `fetch` calls to the Student Portal (adding the Bearer token).
5.  **Frontend Core:** Build the `SessionRecorder` component using `MediaRecorder`.
6.  **TTS:** Hook up `window.speechSynthesis` ensuring language codes (`en-US`, `zh-CN`) are correct.
7.  **Testing:** Test the full loop (Record -> Upload -> Transcribe -> Translate -> Speak).

---

## 7. Deployment Strategy

We will use the **Student Portal Deployment API**.

**Requirements for Repository:**
1.  **Port:** App must start on the port defined by `process.env.PORT` (default 8000).
2.  **Token:** The app will receive `AI_BUILDER_TOKEN` as an environment variable at runtime.
3.  **Secrets:** Do NOT commit `.env` files.

**Deployment Steps (Agent Instructions):**
1.  When code is ready, help the user create a `deploy-config.json` containing:
    ```json
    {
      "repo_url": "YOUR_GITHUB_REPO_URL",
      "branch": "main",
      "service_name": "family-voice-bridge",
      "port": 8000
    }
    ```
    *(Note: Do not commit sensitive env vars like DATABASE_URL; instruct the user to handle these separately or via the `env_vars` field in the deployment payload if secure)*.
2.  Prompt the user to trigger a deployment via `POST /v1/deployments` using the `openapi.json` definition.
3.  Polling: Check `GET /v1/deployments/{service_name}` until status is `HEALTHY`.