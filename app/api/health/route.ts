import { NextResponse } from 'next/server';
import { findOne } from '@/lib/db';

export async function GET() {
  const checks = {
    database: false,
    apiKeys: {
      tavily: !!process.env.TAVILY_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      nextauth: !!process.env.NEXTAUTH_SECRET,
    },
    timestamp: new Date().toISOString(),
  };

  // Test database connection
  try {
    const result = await findOne('SELECT 1 as test');
    checks.database = !!result;
  } catch (err) {
    checks.database = false;
  }

  return NextResponse.json(checks);
}
