import { NextRequest, NextResponse } from 'next/server';
import { runDailyPriceSync } from '@/lib/market-sync';
import { refreshMoversCache, vacuumSnapshots } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Speculation Market daily snapshot — triggered by a Fly scheduled machine
 * (see scripts/setup-market-sync-schedule.sh) once a day. Also refreshes
 * the movers cache afterward, so the (expensive) gainers/losers aggregation
 * runs here, once a day, instead of on every Market page load. */
export async function GET(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const syncResult = await runDailyPriceSync();
    console.log('Market sync complete:', syncResult);

    await vacuumSnapshots();
    console.log('Vacuumed market_price_snapshots.');

    const moversResult = await refreshMoversCache();
    console.log('Movers cache refreshed:', moversResult);

    return NextResponse.json({ success: true, sync: syncResult, movers: moversResult });
  } catch (e) {
    console.error('Market sync failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}
