# Family Voice Bridge - Backend

A Next.js backend application for facilitating bilingual communication between Chinese-speaking and English-speaking family members.

## Architecture

- **Framework:** Next.js 14 (App Router) with TypeScript
- **Database:** PostgreSQL
- **AI Services:** Student Portal API (ASR, Translation, Summaries)

## Setup

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Student Portal API key (`SUPER_MIND_API_KEY`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your actual values
```

3. Run database migrations:
```bash
npm run db:migrate
```

### Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `STUDENT_PORTAL_URL` - Base URL for Student Portal API (default: https://api.ai-builders.com/backend)
- `SUPER_MIND_API_KEY` - API key for Student Portal authentication (or `AI_BUILDER_TOKEN`)

## Development

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`

## Testing

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for comprehensive testing instructions.

Quick test:
```bash
# 1. Set up test data in PostgreSQL
psql -U postgres -d postgres -f scripts/setup-test-data.sql

# 2. Run quick API test
npm run test:api

# 3. Test in browser
# Open http://localhost:3000
```

## API Routes

### Sessions

- `POST /api/sessions/start` - Start a new conversation session
- `POST /api/sessions/[sessionId]/mom-turn` - Process mom's Chinese speech turn
- `POST /api/sessions/[sessionId]/reply-turn` - Process partner's English reply turn
- `POST /api/sessions/[sessionId]/tag` - Tag conversation with situation tag

### Summaries

- `POST /api/summaries/generate` - Generate daily summary from conversations

## Database Schema

See `schema.sql` for the complete database schema.

## Project Structure

```
├── app/
│   └── api/              # Next.js API routes
├── lib/
│   ├── db.ts             # PostgreSQL client
│   └── ai-client.ts      # Student Portal API wrapper
├── scripts/
│   └── migrate.ts         # Database migration script
└── schema.sql            # Database schema definition
```

