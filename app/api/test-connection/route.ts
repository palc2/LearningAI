import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.STUDENT_PORTAL_URL || 'https://api.ai-builders.com/backend';
  const apiKey = process.env.SUPER_MIND_API_KEY || process.env.AI_BUILDER_TOKEN;
  
  const results = {
    baseUrl,
    apiKeyConfigured: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    tests: [] as Array<{ name: string; status: string; error?: string }>,
  };

  // Test 1: DNS Resolution
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname;
    // Try to resolve hostname (this is a basic check)
    results.tests.push({
      name: 'DNS Resolution',
      status: 'pending',
    });
  } catch (error) {
    results.tests.push({
      name: 'URL Parsing',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Invalid URL format',
    });
  }

  // Test 2: API Connection
  try {
    const testUrl = `${baseUrl}/v1/models`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });

    if (response.ok) {
      results.tests.push({
        name: 'API Connection',
        status: 'success',
      });
    } else {
      results.tests.push({
        name: 'API Connection',
        status: 'failed',
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const cause = (error as any).cause;
    
    if (cause?.code === 'ENOTFOUND') {
      results.tests.push({
        name: 'API Connection',
        status: 'failed',
        error: `DNS lookup failed: Cannot resolve ${new URL(baseUrl).hostname}. ` +
               `Check your network connection and DNS settings.`,
      });
    } else {
      results.tests.push({
        name: 'API Connection',
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  return NextResponse.json(results);
}

