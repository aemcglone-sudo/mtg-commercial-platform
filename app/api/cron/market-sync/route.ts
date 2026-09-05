import { NextRequest, NextResponse } from 'next/server';
import { runDailyPriceSync } from '@/lib/market-sync';
import { refreshMoversCache, vacuumSnapshots, vacuumPredictions, refreshHighValueCache, refreshCategoryHighValueCache } from '@/lib/market';
import { refreshSetReleaseDates, calculateSignals } from '@/lib/signal-calculator';
import { seedPatternLibrary, calculatePredictions } from '@/lib/prediction-engine';
import { refreshCardNews } from '@/lib/card-news';
import { refreshMarketIndex } from '@/lib/market-index';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Speculation Market daily snapshot — triggered by a Fly scheduled machine
 * (see scripts/setup-market-sync-schedule.sh) once a day. Also refreshes
 * the movers cache and market_signals afterward, so the expensive
 * aggregations run here, once a day, instead of on every page load.
 *
 * Deliberately NOT calling calculateVolatilitySignals() yet — see the long
 * comment on it in lib/signal-calculator.ts for why it's held back. */
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

    let highValueResult: unknown = { skipped: true };
    try {
      highValueResult = await refreshHighValueCache();
      console.log('High value cards cache refreshed:', highValueResult);
    } catch (e) {
      console.error('High value cache refresh failed (non-fatal):', e);
      highValueResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

    let categoryResult: unknown = { skipped: true };
    try {
      categoryResult = await refreshCategoryHighValueCache();
      console.log('Category high value cache refreshed:', categoryResult);
    } catch (e) {
      console.error('Category high value cache refresh failed (non-fatal):', e);
      categoryResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

    const releaseDatesCount = await refreshSetReleaseDates();
    console.log('Set release dates refreshed:', releaseDatesCount);

    const signalsResult = await calculateSignals();
    console.log('Signals calculated:', signalsResult);

    await seedPatternLibrary();
    const predictionsResult = await calculatePredictions();
    console.log('Predictions calculated:', predictionsResult);

    await vacuumPredictions();
    console.log('Vacuumed market_predictions.');

    // Isolated from the rest: a Tavily/Gemini hiccup shouldn't fail a run
    // that already successfully wrote prices, signals, and predictions.
    let newsResult: unknown = { skipped: true };
    try {
      newsResult = await refreshCardNews();
      console.log('Card news refreshed:', newsResult);
    } catch (e) {
      console.error('Card news refresh failed (non-fatal):', e);
      newsResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

    // Also isolated: each index/backfill query is scoped to one date (see
    // lib/market-index.ts), but this is new enough not to risk the rest of
    // an otherwise-successful run over it.
    let indexResult: unknown = { skipped: true };
    try {
      indexResult = await refreshMarketIndex();
      console.log('Market index refreshed:', indexResult);
    } catch (e) {
      console.error('Market index refresh failed (non-fatal):', e);
      indexResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

    return NextResponse.json({ success: true, sync: syncResult, movers: moversResult, highValue: highValueResult, categoryHighValue: categoryResult, signals: signalsResult, predictions: predictionsResult, news: newsResult, index: indexResult });
  } catch (e) {
    console.error('Market sync failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}
