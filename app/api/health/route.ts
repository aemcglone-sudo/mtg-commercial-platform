import { NextResponse } from 'next/server';
import { findOne } from '@/lib/db';
import { seedIfNeeded } from '@/lib/seed';

export async function GET() {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const result = await findOne('SELECT 1 as test');
    checks.database = !!result;
    await seedIfNeeded();
  } catch {
    checks.database = false;
  }

  return NextResponse.json(checks);
}
