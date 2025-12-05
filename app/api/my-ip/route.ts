import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper endpoint to show your current IP address
 * Useful for adding to rate limit whitelist
 */
export async function GET(request: NextRequest) {
  // Get client IP from headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = forwarded?.split(',')[0].trim() || realIP || 'unknown';
  
  return NextResponse.json({
    yourIP: clientIP,
    headers: {
      'x-forwarded-for': forwarded,
      'x-real-ip': realIP,
    },
    instructions: {
      step1: 'Add this IP to DEVELOPER_WHITELIST_IPS environment variable',
      step2: 'Format: DEVELOPER_WHITELIST_IPS="your.ip.here,another.ip.here"',
      step3: 'Or add directly in lib/rate-limit.ts in DEVELOPER_WHITELIST_IPS array',
    },
  });
}

