import { NextRequest, NextResponse } from 'next/server';
import { runDailyPriceSync } from '@/lib/market-sync';
import { refreshMoversCache, vacuumSnapshots, vacuumPredictions, refreshHighValueCache, refreshCategoryHighValueCache, refreshFoilPremiumCache } from '@/lib/market';
import { refreshDeckValueCache } from '@/lib/deck-value';
import { refreshPreconValueCache } from '@/lib/precon';
import { refreshEdhrecSnapshots, refreshEdhrecPopularityCache } from '@/lib/edhrec-tracker';
import { refreshSetReleaseDates, calculateSignals } from '@/lib/signal-calculator';
import { seedPatternLibrary, calculatePredictions } from '@/lib/prediction-engine';
import { refreshCardNews } from '@/lib/card-news';
import { refreshMarketIndex } from '@/lib/market-index';
import { refreshPortfolioCache } from '@/lib/portfolio';

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

    let foilPremiumResult: unknown = { skipped: true };
    try {
      foilPremiumResult = await refreshFoilPremiumCache();
      console.log('Foil premium cache refreshed:', foilPremiumResult);
    } catch (e) {
      console.error('Foil premium cache refresh failed (non-fatal):', e);
      foilPremiumResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

    const releaseDatesCount = await refreshSetReleaseDates();
    console.log('Set release dates refreshed:', releaseDatesCount);

    // Isolated like everything else below: a transient DB connection drop
    // during this (long-running, per-card) step must not also take out
    // portfolio/deck-value/precon-value/news/index for the whole run.
    let signalsResult: unknown = { skipped: true };
    let predictionsResult: unknown = { skipped: true };
    try {
      signalsResult = await calculateSignals();
      console.log('Signals calculated:', signalsResult);

      await seedPatternLibrary();
      predictionsResult = await calculatePredictions();
      console.log('Predictions calculated:', predictionsResult);

      await vacuumPredictions();
      console.log('Vacuumed market_predictions.');
    } catch (e) {
      console.error('Signals/predictions failed (non-fatal):', e);
      const errMsg = e instanceof Error ? e.message : 'unknown';
      if (signalsResult && typeof signalsResult === 'object' && 'skipped' in signalsResult) signalsResult = { error: errMsg };
      if (predictionsResult && typeof predictionsResult === 'object' && 'skipped' in predictionsResult) predictionsResult = { error: errMsg };
    }

    let portfolioResult: unknown = { skipped: true };
    try {
      portfolioResult = await refreshPortfolioCache();
      console.log('Portfolio cache refreshed:', portfolioResult);
    } catch (e) {
      console.error('Portfolio cache refresh failed (non-fatal):', e);
      portfolioResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

    let deckValueResult: unknown = { skipped: true };
    try {
      deckValueResult = await refreshDeckValueCache();
      console.log('Deck value cache refreshed:', deckValueResult);
    } catch (e) {
      console.error('Deck value cache refresh failed (non-fatal):', e);
      deckValueResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

    let preconValueResult: unknown = { skipped: true };
    try {
      preconValueResult = await refreshPreconValueCache();
      console.log('Precon value cache refreshed:', preconValueResult);
    } catch (e) {
      console.error('Precon value cache refresh failed (non-fatal):', e);
      preconValueResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

    // Isolated: EDHREC pulls ~20 external pages sequentially — a timeout
    // or their site blocking us shouldn't fail an otherwise-successful run.
    let edhrecResult: unknown = { skipped: true };
    try {
      const snapshotResult = await refreshEdhrecSnapshots();
      const cacheResult = await refreshEdhrecPopularityCache();
      edhrecResult = { ...snapshotResult, ...cacheResult };
      console.log('EDHREC popularity snapshots refreshed:', edhrecResult);
    } catch (e) {
      console.error('EDHREC popularity snapshot refresh failed (non-fatal):', e);
      edhrecResult = { error: e instanceof Error ? e.message : 'unknown' };
    }

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

    return NextResponse.json({ success: true, sync: syncResult, movers: moversResult, highValue: highValueResult, categoryHighValue: categoryResult, foilPremium: foilPremiumResult, signals: signalsResult, predictions: predictionsResult, portfolio: portfolioResult, deckValue: deckValueResult, preconValue: preconValueResult, edhrecPopularity: edhrecResult, news: newsResult, index: indexResult });
  } catch (e) {
    console.error('Market sync failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}
