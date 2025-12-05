/**
 * Rate Limiting Utility
 * 
 * Simple in-memory rate limiter using sliding window algorithm.
 * For production with multiple instances, consider upgrading to Redis-based solution (e.g., Upstash).
 */

interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional custom key generator (defaults to IP address) */
  keyGenerator?: (request: Request) => string | Promise<string>;
  /** Optional list of IP addresses to exclude from rate limiting (whitelist) */
  whitelistIPs?: string[];
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // Seconds until retry is allowed
}

interface RequestRecord {
  timestamps: number[];
  count: number;
}

// In-memory store: Map<key, RequestRecord>
// In production with multiple instances, use Redis instead
const requestStore = new Map<string, RequestRecord>();

// Cleanup old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupTimer() {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, record] of requestStore.entries()) {
      // Remove timestamps older than 1 hour
      record.timestamps = record.timestamps.filter(ts => now - ts < CLEANUP_INTERVAL_MS);
      
      if (record.timestamps.length === 0) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => requestStore.delete(key));
    
    if (requestStore.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Get client IP address from request
 */
function getClientIP(request: Request): string {
  // Check various headers (in order of preference)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback (won't work in serverless, but useful for development)
  return 'unknown';
}

/**
 * Rate limit check using sliding window algorithm
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, keyGenerator, whitelistIPs } = config;
  
  // Generate key (default to IP address)
  const clientIP = getClientIP(request);
  const key = keyGenerator 
    ? await keyGenerator(request)
    : clientIP;
  
  // Check if IP is whitelisted (skip rate limiting)
  if (whitelistIPs && whitelistIPs.includes(clientIP)) {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests, // Show full limit remaining
      reset: Math.ceil((Date.now() + windowMs) / 1000),
    };
  }
  
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Get or create record
  let record = requestStore.get(key);
  if (!record) {
    record = { timestamps: [], count: 0 };
    requestStore.set(key, record);
    startCleanupTimer();
  }
  
  // Remove timestamps outside the window
  record.timestamps = record.timestamps.filter(ts => ts > windowStart);
  record.count = record.timestamps.length;
  
  // Check if limit exceeded
  if (record.count >= maxRequests) {
    // Calculate retry after (oldest timestamp + window - now)
    const oldestTimestamp = Math.min(...record.timestamps);
    const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
    
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: Math.ceil((oldestTimestamp + windowMs) / 1000),
      retryAfter: Math.max(0, retryAfter),
    };
  }
  
  // Add current request timestamp
  record.timestamps.push(now);
  record.count = record.timestamps.length;
  
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.count,
    reset: Math.ceil((now + windowMs) / 1000),
  };
}

/**
 * Developer IP whitelist - IPs in this list bypass rate limiting
 * Add your IP addresses here for unlimited development access
 * 
 * Option 1: Set via environment variable (recommended for production)
 *   DEVELOPER_WHITELIST_IPS="1.2.3.4,5.6.7.8"
 * 
 * Option 2: Add directly in the array below (for quick local development)
 *   ['1.2.3.4', '5.6.7.8']
 * 
 * To find your IP: Visit http://localhost:3000/api/my-ip when running locally
 *                   Or check your public IP at https://api.ipify.org
 */
const DEVELOPER_WHITELIST_IPS = (
  process.env.DEVELOPER_WHITELIST_IPS?.split(',').map(ip => ip.trim()).filter(Boolean) || 
  // Add your IP addresses here for local development (remove before committing if sensitive)
  ['108.41.16.119'] // Developer IP - unlimited access for development
);

/**
 * Predefined rate limit configurations for different endpoints
 */
export const RateLimitConfigs = {
  /** Session start: 15 sessions per day per IP */
  SESSION_START: {
    maxRequests: 15,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    whitelistIPs: DEVELOPER_WHITELIST_IPS,
  },
  
  /** Audio processing (mom-turn/reply-turn): 50 requests per hour per IP */
  AUDIO_PROCESSING: {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    whitelistIPs: DEVELOPER_WHITELIST_IPS,
  },
  
  /** Tagging: 100 requests per hour per IP */
  TAGGING: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    whitelistIPs: DEVELOPER_WHITELIST_IPS,
  },
  
  /** Summary generation: 10 requests per day per IP */
  SUMMARY_GENERATION: {
    maxRequests: 10,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    whitelistIPs: DEVELOPER_WHITELIST_IPS,
  },
  
  /** General API: 200 requests per hour per IP */
  GENERAL: {
    maxRequests: 200,
    windowMs: 60 * 60 * 1000, // 1 hour
    whitelistIPs: DEVELOPER_WHITELIST_IPS,
  },
} as const;

/**
 * Create a rate limit middleware function for Next.js API routes
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (request: Request): Promise<Response | null> => {
    const result = await rateLimit(request, config);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
          limit: result.limit,
          reset: result.reset,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': result.retryAfter?.toString() || '0',
          },
        }
      );
    }
    
    // Add rate limit headers to successful responses
    return null; // null means continue processing
  };
}

/**
 * Helper to check rate limit and return error response if exceeded
 * Returns null if rate limit is OK, or a Response object if limit exceeded
 */
export async function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<Response | null> {
  const middleware = createRateLimitMiddleware(config);
  return middleware(request);
}

