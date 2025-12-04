# Product Spec: Family Voice Bridge

| Metadata | Details |
| :--- | :--- |
| **Product** | [cite_start]Family Voice Bridge [cite: 3] |
| **Owner** | [cite_start]Paloma (PM/Founder) [cite: 4] |
| [cite_start]**Version** | v0.2 [cite: 5] |
| **Status** | [cite_start]Draft – MVP spec [cite: 6] |
| **Last Updated** | [cite_start]2025-12-02 [cite: 7] |

---

## 1. TL;DR
Family Voice Bridge is a **mobile-first web app** that:
* [cite_start]Lets **Mom (Chinese-speaking)** press one big button to speak Chinese → plays **natural English** audio to the English speaker[cite: 9, 10].
* [cite_start]Listens to the **English reply** and plays back **Chinese** to Mom[cite: 11].
* [cite_start]Quietly logs the conversation turns, auto-tags them by "situation / 场景", and generates a **daily recap + key phrases** so Mom can review and learn over time[cite: 12].
* [cite_start]**MVP:** A simple, two-turn session (Mom → reply → done), plus a Daily Review screen[cite: 13].

---

## 2. Background & Problem

### Context
* [cite_start]**User:** Mom (60), native Chinese, limited English, visiting US for 5.5 months to help with newborn[cite: 16].
* [cite_start]**Environment:** Home (kitchen, baby care, food, postpartum support)[cite: 17].
* [cite_start]**Devices:** Mom’s Samsung phone (Android), stable home Wi-Fi[cite: 18].

### Core Problems
1.  [cite_start]**Friction in conversations:** Mom has to juggle Google Translate or Perplexity; conversations stall, and she says less than she wants to [cite: 20-22].
2.  **Lost learning opportunities:** Useful daily phrases are not captured; [cite_start]English exposure doesn't compound into learning [cite: 23-25].
3.  [cite_start]**Emotional distance:** She feels like an outsider or "less helpful," discouraging her from initiating conversations [cite: 26-28].

### Product Vision
[cite_start]Build a household "supermind": a single web app that acts as **translator, memory, and tutor** for the family’s real-life multilingual conversations[cite: 30].

---

## 3. Goals, Non-Goals & Success Metrics

### 3.1 Goals (MVP)
* [cite_start]**Low-friction communication:** Mom can start/finish short conversations without switching apps or typing [cite: 33-34].
* [cite_start]**Daily exposure & reflection:** Conversations are captured and distilled into meaningful phrases for review [cite: 35-36].
* [cite_start]**Extensible foundation:** Codebase allows easy addition of languages (Bangla), quizzes, or learner profiles [cite: 37-41].

### 3.2 Non-Goals (MVP)
* [cite_start]Adaptive/spaced-repetition learning paths[cite: 43].
* [cite_start]Rich user management, auth, or SaaS polish[cite: 44].
* [cite_start]High-latency streaming ASR/TTS (focus is on discrete turns)[cite: 45].
* [cite_start]Complex analytics dashboards[cite: 46].

### 3.3 OKRs (MVP)
* **Objective 1 – Enable smooth, low-friction daily communication**
    * [cite_start]**KR1.1:** ≥ 80% of translation turns finish playback within ≤ 4 seconds[cite: 49].
    * [cite_start]**KR1.2:** Mom uses app ≥ 5 sessions/day on ≥ 5 days/week[cite: 50].
* **Objective 2 – Turn daily life into a gentle learning loop**
    * [cite_start]**KR2.1:** Daily review shows ≥ 1 summary + 5 phrases for days with ≥ 3 sessions[cite: 52].
    * [cite_start]**KR2.2:** Mom listens to 3 of 5 daily phrases on ≥ 60% of days[cite: 53].
    * [cite_start]**KR2.3:** System surfaces ≥ 50 distinct useful phrases over 5.5 months[cite: 54].
* **Objective 3 – Build a reliable, extensible "household supermind"**
    * [cite_start]**KR3.1:** ≥ 99% uptime during waking hours (7am–11pm)[cite: 56].
    * [cite_start]**KR3.2:** ≥ 95% of turns logged with valid situation tag[cite: 57].
    * [cite_start]**KR3.3:** Adding Bangla or basic quiz mode is feasible in ≤ 1 week of dev[cite: 58].

---

## 4. Users & Personas

* **Primary: Mom (60)**
    * Native Chinese, limited English. Uses Samsung Android.
    * [cite_start]**Needs:** Talk to son-in-law/mother-in-law, collaborate on baby care/chores, learn practical English [cite: 60-67].
* **Secondary: You (Bilingual)**
    * [cite_start]Orchestrates conversations, checks logs, helps Mom practice [cite: 68-71].
* **Secondary: Husband & Mother-in-law (English/Bangla)**
    * Participate by replying in English. [cite_start]Want low mental load (app handles translation) [cite: 72-74].
* **Future: Child (6-12mo+)**
    * [cite_start]Use conversations as a language-learning hub [cite: 75-77].

---

## 5. Scope & Features (MVP)

### 5.1 Feature 1: One-Turn Voice Translation (Mom ↔ English Speaker)
**In Scope:**
* [cite_start]**UI:** Mobile-first web app with a single large "Speak" button[cite: 81].
* **Session Flow (Fixed 2 Turns):**
    1.  [cite_start]Mom taps "Speak" → App records Chinese audio[cite: 83].
    2.  [cite_start]**Backend:** Transcribes Chinese → Translates to English [cite: 84-86].
    3.  [cite_start]**Frontend:** Speaks English via Web Speech API[cite: 87].
    4.  **Reply Mode:** App immediately starts listening for English reply after English playback finishes. Recording auto-stops after 10 seconds (with visual countdown), or can be stopped manually earlier [cite: 88-90].
    5.  [cite_start]**Backend:** Transcribes English → Translates to Chinese [cite: 91-93].
    6.  [cite_start]**Frontend:** Speaks Chinese back to Mom[cite: 94].

[cite_start]**Out of Scope (v1):** Multi-turn conversations (>2 turns), Streaming ASR/TTS [cite: 96-98].

### 5.2 Feature 2: Daily Conversation Log
**In Scope:**
* [cite_start]**Data:** Stores session_id, timestamps, roles, source/target text, and situation_tag (async) [cite: 101-106].
* [cite_start]**UI:** "Today’s Conversations" list (chronological) with short label (e.g., "Kitchen") and text preview [cite: 107-112].
* [cite_start]**Details:** Tapping a session shows full text and optional TTS replay [cite: 113-115].

### 5.3 Feature 3: Daily Review & Key Phrases
**In Scope:**
* **Daily Digest:**
    * [cite_start]Short topic summary (ZH + EN)[cite: 119].
    * [cite_start]"What’s new today" snippet[cite: 120].
    * [cite_start]**5 English Phrases:** With Chinese translation and play button [cite: 121-124].
* [cite_start]**Tracking:** Simple "mark as listened"[cite: 125].

[cite_start]**Out of Scope (v1):** Quizzes, spaced repetition, per-user learning paths [cite: 126-128].

### 5.4 Feature 4: Infrastructure & Tech
* **Frontend:** React / Next.js. [cite_start]Uses `getUserMedia`, `MediaRecorder`, and `speechSynthesis` [cite: 130-133].
* **Backend:** App server (FastAPI/Node) + DB. [cite_start]Uses Student Portal APIs (`/transcriptions`, `/chat/completions`) [cite: 134-138].
* **Latency Strategy:** Hot path for ASR/Translation/TTS; [cite_start]Background for summaries/tagging [cite: 140-142].

---

## 6. High-Level Architecture

1.  [cite_start]**Client (Mobile Web App):** Captures audio, plays TTS, displays logs/review [cite: 144-149].
2.  [cite_start]**Application Backend:** Handles session orchestration, DB persistence, and calls Student Portal APIs [cite: 150-156].
3.  [cite_start]**Database:** Tables for `households`, `users`, `conversation_sessions`, `conversation_turns`, `daily_summaries`, `daily_key_phrases` [cite: 157-161]. [cite_start]No raw audio stored[cite: 162].

---

## 7. Functional Requirements (FRs)

* [cite_start]**FR-1: Start Session:** Large button for Mom to start recording with clear visual state [cite: 165-167].
* [cite_start]**FR-2: Translate Mom:** Stop recording → Transcribe ZH → Translate EN → Play EN audio [cite: 168-172].
* **FR-3: Capture Reply:** Auto-listen immediately after English playback finishes (no delay). Recording auto-stops after 10 seconds with visual countdown, or can be stopped manually earlier [cite: 173-178].
* [cite_start]**FR-4: Translate Reply:** Stop recording → Transcribe EN → Translate ZH → Play ZH audio [cite: 179-183].
* [cite_start]**FR-5: Persist Data:** Store session and turn data with timestamps [cite: 184-188].
* [cite_start]**FR-6: Auto Situation Tagging:** Background job infers tag (e.g., "Baby", "Kitchen") [cite: 189-192].
* [cite_start]**FR-7: Daily Summary:** Aggregate turns into Topic Summary + "What's New" + 5 Phrases [cite: 193-198].
* [cite_start]**FR-8: Daily Review UI:** View summary and play audio for phrases [cite: 199-201].
* [cite_start]**FR-9: Conversation Log UI:** List sessions with text previews and replays [cite: 202-204].

---

## 8. Non-Functional Requirements (NFRs)

* [cite_start]**Performance:** Target ≤ 3 seconds from end of speech to playback[cite: 207]. Partner recorder initialization runs in parallel with TTS playback to minimize latency. Database writes are non-blocking (fire-and-forget) to improve response times.
* [cite_start]**Reliability:** ≥ 99% uptime (waking hours)[cite: 209].
* [cite_start]**Usability:** Large tap targets, minimal text, clear state indicators, accessible contrast/font [cite: 211-214, 220].
* **Privacy:** No raw audio stored long term. [cite_start]Household data not public [cite: 216-218].

---

## 9. Risks & Assumptions

* **Assumptions:** Stable Wi-Fi; [cite_start]Mom willing to use web app [cite: 224-225].
* **Risks:** Browser mic access limits; API latency spikes; [cite_start]ASR accuracy on accents [cite: 227-229].
* [cite_start]**Mitigations:** Test on specific device early; retry logic; graceful failure UI [cite: 231-233].

---

## 10. Implementation Decision Log

1.  [cite_start]**Session Model:** V1 is exactly 2 turns (Mom → Reply → Done) for simplicity [cite: 236-239].
2.  [cite_start]**Tech Stack:** Mobile-first web app (React/Next.js) + Web Speech API for fast iteration [cite: 240-245].
3.  [cite_start]**LLM Backend:** Student Portal APIs (`transcriptions`, `completions`, `embeddings`) [cite: 246-252].
4.  [cite_start]**Data Model:** Relational tables for households, sessions, turns, and summaries [cite: 253-259].
5.  [cite_start]**Summary Gen:** Single LLM call per day to reduce complexity [cite: 260-263].
6.  **Latency Optimization:** Partner recorder initialization runs in parallel with TTS playback. Database writes for conversation turns are non-blocking (fire-and-forget) to return responses immediately. Situation tagging runs in background after session completion.
7.  **Auto-stop Timer:** Partner recording automatically stops after 10 seconds with visual countdown, eliminating need for manual stop while still allowing early manual stop if desired.

---

## 11. Open Questions

* [cite_start]Do we want any minimal auth (e.g., single shared password)? [cite: 266]
* [cite_start]How much manual override do you need for situation tags? [cite: 267]
* [cite_start]Do we want a "favorites" feature for phrases in v1? [cite: 268]
* [cite_start]Do we want multi-language support (Bangla) in v1 or defer? [cite: 269]