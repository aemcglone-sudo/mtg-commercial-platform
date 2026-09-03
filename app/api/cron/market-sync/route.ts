import { NextRequest, NextResponse } from 'next/server';
import { runDailyPriceSync } from '@/lib/market-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Speculation Market daily snapshot — triggered by a Fly scheduled machine
 * (see scripts/setup-market-sync-schedule.sh) once a day. */
export async function GET(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyPriceSync();
    console.log('Market sync complete:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('Market sync failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}
