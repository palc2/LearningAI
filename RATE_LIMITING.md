# Rate Limiting Configuration

This document explains the rate limiting implementation and how to configure it.

## Overview

Rate limiting has been implemented to protect your API from abuse and control costs. The system uses a **sliding window algorithm** with **in-memory storage** (suitable for single-instance deployments).

## Rate Limits by Endpoint

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| `/api/sessions/start` | 15 requests | 24 hours | Prevents session spam and controls costs |
| `/api/sessions/[id]/mom-turn` | 50 requests | 1 hour | Limits expensive audio processing |
| `/api/sessions/[id]/reply-turn` | 50 requests | 1 hour | Limits expensive audio processing |
| `/api/sessions/[id]/tag` | 100 requests | 1 hour | Limits tagging API calls |
| `/api/summaries/generate` | 10 requests | 24 hours | Prevents expensive summary generation abuse |

## How It Works

### Rate Limiting Algorithm
- **Sliding Window**: Tracks requests within a rolling time window
- **Per-IP**: Limits are applied per IP address (from `x-forwarded-for` or `x-real-ip` headers)
- **In-Memory Storage**: Uses a Map to track request timestamps
- **Automatic Cleanup**: Old entries are cleaned up every hour to prevent memory leaks

### Rate Limit Headers
When a request is rate-limited, the API returns:
- **Status Code**: `429 Too Many Requests`
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining (0 when limited)
  - `X-RateLimit-Reset`: Unix timestamp when limit resets
  - `Retry-After`: Seconds to wait before retrying

### Example Rate Limit Response
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 1234 seconds.",
  "retryAfter": 1234,
  "limit": 20,
  "reset": 1704067200
}
```

## Configuration

### Adjusting Rate Limits

Edit `lib/rate-limit.ts` to modify the `RateLimitConfigs` object:

```typescript
export const RateLimitConfigs = {
  SESSION_START: {
    maxRequests: 15,      // Change this number
    windowMs: 24 * 60 * 60 * 1000,  // Change this (milliseconds) - 24 hours
  },
  // ... other configs
};
```

### Common Adjustments

**For your mom's usage (5 sessions/day):**
- Current limit: 15 sessions/day per IP
- Your mom's usage (5 sessions/day) is well within the limit ✅

**To allow more testers:**
- Increase `AUDIO_PROCESSING` limit: `maxRequests: 100` (allows 100 audio requests/hour)
- Increase `SESSION_START` limit: `maxRequests: 20` (allows 20 sessions/day)

**To be more restrictive (save costs):**
- Decrease `SESSION_START`: `maxRequests: 10` (10 sessions/hour)
- Decrease `AUDIO_PROCESSING`: `maxRequests: 20` (20 audio requests/hour)

## Production Considerations

### Current Implementation (Single Instance)
- ✅ Works well for single-instance deployments (like Koyeb nano containers)
- ✅ Simple, no external dependencies
- ✅ Automatic memory cleanup
- ⚠️ **Limitation**: Rate limits reset on server restart
- ⚠️ **Limitation**: Not shared across multiple instances

### Upgrading to Redis (Multi-Instance)
If you scale to multiple instances, upgrade to Redis-based rate limiting:

1. **Install Upstash Redis** (free tier available):
   ```bash
   npm install @upstash/ratelimit @upstash/redis
   ```

2. **Update `lib/rate-limit.ts`** to use Upstash:
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";
   
   const redis = new Redis({
     url: process.env.UPSTASH_REDIS_REST_URL!,
     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
   });
   
   const ratelimit = new Ratelimit({
     redis: redis,
     limiter: Ratelimit.slidingWindow(maxRequests, windowMs),
   });
   ```

3. **Add environment variables**:
   ```
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

## Testing Rate Limits

### Test with curl:
```bash
# Test session start limit (15/day)
for i in {1..20}; do
  curl -X POST https://your-app.com/api/sessions/start \
    -H "Content-Type: application/json" \
    -d '{"householdId":"...","initiatedByUserId":"..."}'
  echo ""
done

# After 15 requests, you should get 429 responses
```

### Check Rate Limit Headers:
```bash
curl -i -X POST https://your-app.com/api/sessions/start \
  -H "Content-Type: application/json" \
  -d '{"householdId":"...","initiatedByUserId":"..."}'

# Look for headers:
# X-RateLimit-Limit: 15
# X-RateLimit-Remaining: 14
# X-RateLimit-Reset: 1704067200
```

## Monitoring

### Check Rate Limit Effectiveness
Monitor your API logs for `429` responses:
```bash
# In your deployment logs
grep "429" logs.txt | wc -l  # Count rate-limited requests
```

### Cost Impact
With rate limiting enabled:
- **Before**: Unlimited abuse could cost $50+/day
- **After**: Maximum cost per IP:
  - 15 sessions/day per IP maximum
  - 15 × $0.025 = **$0.375/day per IP maximum**
  - Much better cost protection! 🎉

## Troubleshooting

### Rate Limits Too Strict
If legitimate users hit limits:
1. Check current limits in `lib/rate-limit.ts`
2. Increase `maxRequests` for the affected endpoint
3. Redeploy

### Rate Limits Not Working
1. Check that rate limiting is imported in route files
2. Verify IP detection (check `x-forwarded-for` header)
3. Check server logs for errors

### Memory Concerns
- Rate limit store cleans up automatically every hour
- Each IP uses ~1KB of memory
- 1000 IPs = ~1MB memory usage (negligible)

## Best Practices

1. **Monitor Usage**: Check logs regularly for 429 responses
2. **Adjust Limits**: Start conservative, increase as needed
3. **User Feedback**: Show rate limit errors clearly in UI
4. **Graceful Degradation**: Handle 429 errors gracefully in frontend

## Frontend Integration

Update your frontend to handle rate limit errors:

```typescript
// In SessionRecorder.tsx or similar
try {
  const response = await fetch('/api/sessions/start', {...});
  
  if (response.status === 429) {
    const error = await response.json();
    const retryAfter = error.retryAfter || 60;
    alert(`Too many requests. Please wait ${retryAfter} seconds.`);
    return;
  }
  
  // ... handle success
} catch (error) {
  // ... handle other errors
}
```

## Summary

✅ **Rate limiting is now active** on all expensive endpoints
✅ **Protects against abuse** and controls costs
✅ **Configurable** via `lib/rate-limit.ts`
✅ **Ready for production** (single instance)
✅ **Upgrade path available** for multi-instance (Redis)

Your app is now protected! The $30 tester budget should be safe with these limits in place.

