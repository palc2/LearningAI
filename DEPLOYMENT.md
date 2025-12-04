# Deployment Guide

This guide will help you deploy Family Voice Bridge to a public URL using the Student Portal Deployment API.

## Prerequisites

1. **GitHub Repository**: Your code must be in a **public** GitHub repository
2. **Production Database**: You need a PostgreSQL database URL for production
3. **API Key**: Your `AI_BUILDER_TOKEN` will be automatically injected (no need to include it)

## Step 1: Prepare Your Repository

1. **Make sure your code is committed and pushed to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Verify your repository is public** (required for deployment)

3. **Update `deploy-config.json`** with your actual values:
   - `repo_url`: Your GitHub repository URL (e.g., `https://github.com/username/family-bridge-v2`)
   - `DATABASE_URL`: Your production PostgreSQL connection string

## Step 2: Update Package.json for Production

The deployment platform needs to know how to start your app. Make sure your `package.json` has:

```json
{
  "scripts": {
    "build": "next build",
    "start": "tsx server.ts"
  }
}
```

**Note**: The platform will automatically:
- Run `npm install`
- Run `npm run build` (if build script exists)
- Run `npm start` to start the server

## Step 3: Deploy via API

### Option A: Using curl

```bash
# Set your API key
export API_KEY="your_ai_builder_token_here"
export API_URL="https://api.ai-builders.com/backend"

# Read deploy-config.json and deploy
curl -X POST "$API_URL/v1/deployments" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @deploy-config.json
```

### Option B: Using the Deployment API directly

You can use any HTTP client or create a simple script. The request should be:

```json
POST https://api.ai-builders.com/backend/v1/deployments
Authorization: Bearer YOUR_AI_BUILDER_TOKEN
Content-Type: application/json

{
  "repo_url": "https://github.com/yourusername/family-bridge-v2",
  "service_name": "family-voice-bridge",
  "branch": "main",
  "port": 8000,
  "env_vars": {
    "DATABASE_URL": "postgresql://user:pass@host:5432/dbname",
    "NODE_ENV": "production"
  }
}
```

## Step 4: Monitor Deployment Status

After triggering deployment, poll the status endpoint:

```bash
# Check deployment status
curl -X GET "$API_URL/v1/deployments/family-voice-bridge" \
  -H "Authorization: Bearer $API_KEY"
```

**Status values:**
- `queued` - Deployment is queued
- `deploying` - Currently deploying
- `HEALTHY` - ✅ Successfully deployed and running
- `UNHEALTHY` - Deployment failed or service is down
- `ERROR` - Deployment error occurred

**Wait 5-10 minutes** for the deployment to complete. Poll every 30 seconds until status is `HEALTHY`.

## Step 5: Access Your App

Once status is `HEALTHY`, your app will be available at:

```
https://family-voice-bridge.ai-builders.space
```

## Important Notes

### Environment Variables

- ✅ **Automatically injected**: `AI_BUILDER_TOKEN` (you don't need to include this)
- ✅ **Include in env_vars**: `DATABASE_URL`, `NODE_ENV`
- ❌ **Never commit**: `.env` files, API keys, passwords

### Database Setup

Before deployment, make sure your production database:
1. Has the schema created (run `schema.sql` or `npm run db:migrate`)
2. Has test data if needed (run `scripts/setup-test-data.sql`)

### Production Server

The app uses `server.ts` which:
- Honors the `PORT` environment variable (defaults to 8000)
- Serves both API routes and static files
- Works with Next.js production build

### Troubleshooting

If deployment fails:

1. **Check the status message** - It will include error details
2. **Verify repository is public** - Private repos won't work
3. **Check build logs** - The platform provides logs in the status response
4. **Verify DATABASE_URL** - Make sure it's accessible from the deployment platform
5. **Check port configuration** - Ensure your app listens on the PORT env variable

### Updating Your Deployment

To update your app:

1. Push new code to your GitHub repository
2. Trigger a new deployment with the same `service_name`
3. The platform will update the existing deployment

## Security Checklist

- [ ] Repository is public (no secrets in code)
- [ ] `.env` is in `.gitignore` ✅ (already done)
- [ ] No API keys or passwords committed to Git
- [ ] Production database credentials are secure
- [ ] `DATABASE_URL` is only in `deploy-config.json` (don't commit this file!)

## Next Steps After Deployment

1. Test the deployed app at `https://family-voice-bridge.ai-builders.space`
2. Test voice recording (requires HTTPS - should work automatically)
3. Test the full conversation flow
4. Share the link with family members!

