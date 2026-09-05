import { run, withClient } from '@/lib/db';
import { randomUUID } from 'crypto';

/** Same reasoning as the signal calculator — this only ever runs from the
 * daily cron job, so a generous timeout is safe. */
async function runWithTimeout(sql: string, args: (string | number)[] = [], timeoutMs = 90000): Promise<{ ok: boolean; error?: string }> {
  try {
    await withClient(async (q) => {
      await q(`SET statement_timeout = ${timeoutMs}`);
      await q(sql, args);
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/**
 * The pattern library, V1 — deliberately scoped to what market_signals
 * actually has data for right now (momentum, release phase, relative
 * value). No tournament/volume signals, no volatility (not live yet — see
 * lib/signal-calculator.ts). predictedPctChange/confidencePct are
 * heuristic starting points drawn from general MTG market knowledge, NOT
 * backtested accuracy — no prediction has had 6 months to resolve yet.
 * This table exists mainly for documentation/transparency; the actual
 * matching is the hardcoded CASE in calculatePredictions() below.
 */
const PATTERNS = [
  {
    name: 'hype_spike_fade',
    description: 'Fresh release (0-7 days) with a sharp 7-day price spike — historically fades hard once supply normalizes.',
    predictedPctChange: -0.60,
    confidencePct: 55,
    priority: 1,
  },
  {
    name: 'supply_flood_continuation',
    description: 'Set is 7-21 days old and price is already declining — supply-flood pressure likely continues.',
    predictedPctChange: -0.30,
    confidencePct: 50,
    priority: 2,
  },
  {
    name: 'stabilization_hold',
    description: 'Set is 21-90 days old — price has typically found its post-hype level and tends to hold.',
    predictedPctChange: 0.0,
    confidencePct: 55,
    priority: 3,
  },
  {
    name: 'undervalued_in_set',
    description: 'Mature card priced well below its set\'s median — modest room to re-rate upward.',
    predictedPctChange: 0.15,
    confidencePct: 45,
    priority: 4,
  },
  {
    name: 'overextended_in_set',
    description: 'Mature card priced well above its set\'s median — some risk of mean reversion toward the set-typical price.',
    predictedPctChange: -0.15,
    confidencePct: 45,
    priority: 5,
  },
  {
    name: 'fallback_neutral',
    description: 'No strong pattern match — default low-confidence hold call.',
    predictedPctChange: 0.0,
    confidencePct: 30,
    priority: 6,
  },
] as const;

export async function seedPatternLibrary(): Promise<number> {
  for (const p of PATTERNS) {
    await run(
      `INSERT INTO market_patterns (id, pattern_name, description, predicted_pct_change, confidence_pct, priority, created_at)
       VALUES (?, ?, ?, ?, ?, ?, now())
       ON CONFLICT (pattern_name) DO UPDATE SET
         description = EXCLUDED.description, predicted_pct_change = EXCLUDED.predicted_pct_change,
         confidence_pct = EXCLUDED.confidence_pct, priority = EXCLUDED.priority`,
      [randomUUID(), p.name, p.description, p.predictedPctChange, p.confidencePct, p.priority]
    );
  }
  return PATTERNS.length;
}

export interface PredictionStepResult { step: string; ok: boolean; error?: string; }

/**
 * One INSERT...SELECT over today's market_signals rows — a single
 * CASE-based pattern match (first matching pattern wins, in priority
 * order), not a blended multi-pattern score. Same shape/cost class as the
 * signal calculator's seed pass, which live-tested at ~16s full-table.
 */
export async function calculatePredictions(): Promise<PredictionStepResult> {
  const sql = `
    INSERT INTO market_predictions (
      id, scryfall_id, date, card_name, set_code, current_price,
      target_price_6m, target_price_6m_low, target_price_6m_high,
      confidence_pct, prediction_direction, matched_pattern, dominant_signals,
      upside_scenario, upside_target, downside_scenario, downside_target, risk_factors
    )
    SELECT
      md5(sig.scryfall_id || sig.date::text),
      sig.scryfall_id, sig.date, snap.card_name, sig.set_code, sig.current_price,

      -- target price: current * (1 + predicted_pct_change)
      GREATEST(sig.current_price * (1 + mp.predicted_pct_change), 0.05),
      GREATEST(sig.current_price * (1 + mp.predicted_pct_change - 0.15), 0.05),
      GREATEST(sig.current_price * (1 + mp.predicted_pct_change + 0.15), 0.05),

      mp.confidence_pct,
      CASE WHEN mp.predicted_pct_change > 0.05 THEN 'bullish' WHEN mp.predicted_pct_change < -0.05 THEN 'bearish' ELSE 'neutral' END,
      sig.pattern,
      jsonb_build_array(
        jsonb_build_object('signal', 'release_phase', 'value', sig.release_phase),
        jsonb_build_object('signal', 'momentum_7d', 'value', sig.momentum_7d),
        jsonb_build_object('signal', 'momentum_30d', 'value', sig.momentum_30d),
        jsonb_build_object('signal', 'price_vs_set_median', 'value', sig.price_vs_set_median)
      ),

      upside_text, GREATEST(sig.current_price * (1 + mp.predicted_pct_change + 0.30), 0.05),
      downside_text, GREATEST(sig.current_price * (1 + mp.predicted_pct_change - 0.30), 0.05),

      CASE WHEN sig.release_phase IN ('presale', 'hype_spike')
        THEN jsonb_build_array('Fresh release — price is still finding its equilibrium, wider-than-usual uncertainty.')
        ELSE '[]'::jsonb
      END

    FROM (
      SELECT
        s.*,
        CASE
          WHEN s.release_phase = 'hype_spike' AND s.momentum_7d > 0.3 THEN 'hype_spike_fade'
          WHEN s.release_phase = 'supply_flood' AND s.momentum_7d < 0 THEN 'supply_flood_continuation'
          WHEN s.release_phase = 'stabilization' THEN 'stabilization_hold'
          WHEN s.release_phase = 'mature' AND s.price_vs_set_median > 0 AND s.price_vs_set_median < 0.5 THEN 'undervalued_in_set'
          WHEN s.release_phase = 'mature' AND s.price_vs_set_median > 2.5 THEN 'overextended_in_set'
          ELSE 'fallback_neutral'
        END as pattern
      FROM market_signals s
      WHERE s.date = CURRENT_DATE AND s.current_price IS NOT NULL
    ) sig
    JOIN market_patterns mp ON mp.pattern_name = sig.pattern
    -- card_name is only on market_price_snapshots, not market_signals; a
    -- same-day lookup by (scryfall_id, price_date) is index-backed via
    -- the existing @@index([scryfallId, priceDate]).
    JOIN market_price_snapshots snap ON snap.scryfall_id = sig.scryfall_id AND snap.price_date = sig.date
    CROSS JOIN LATERAL (
      SELECT
        CASE sig.pattern
          WHEN 'hype_spike_fade' THEN 'If hype holds and the card sees real tournament adoption before supply catches up.'
          WHEN 'supply_flood_continuation' THEN 'If the card finds a niche once supply pressure eases.'
          WHEN 'stabilization_hold' THEN 'If demand strengthens beyond its current settled level.'
          WHEN 'undervalued_in_set' THEN 'If the set overall gains attention, pulling underpriced cards up with it.'
          WHEN 'overextended_in_set' THEN 'If genuine new demand (a format shift, a combo discovery) justifies the premium.'
          ELSE 'If a catalyst (reprint news, format shift, tournament result) moves the price meaningfully.'
        END as upside_text,
        CASE sig.pattern
          WHEN 'hype_spike_fade' THEN 'The typical case — hype fades once supply normalizes over the next few weeks.'
          WHEN 'supply_flood_continuation' THEN 'Supply pressure continues and demand doesn''t show up to absorb it.'
          WHEN 'stabilization_hold' THEN 'Set demand cools further as the format moves on.'
          WHEN 'undervalued_in_set' THEN 'The discount is deserved — this card just isn''t a set standout.'
          WHEN 'overextended_in_set' THEN 'The premium was hype-driven and reverts toward the set median.'
          ELSE 'No strong signal either way — this is a low-conviction default, not a real call.'
        END as downside_text
    ) txt
    ON CONFLICT (scryfall_id, date) DO UPDATE SET
      card_name = EXCLUDED.card_name,
      set_code = EXCLUDED.set_code,
      current_price = EXCLUDED.current_price,
      target_price_6m = EXCLUDED.target_price_6m,
      target_price_6m_low = EXCLUDED.target_price_6m_low,
      target_price_6m_high = EXCLUDED.target_price_6m_high,
      confidence_pct = EXCLUDED.confidence_pct,
      prediction_direction = EXCLUDED.prediction_direction,
      matched_pattern = EXCLUDED.matched_pattern,
      dominant_signals = EXCLUDED.dominant_signals,
      upside_scenario = EXCLUDED.upside_scenario,
      upside_target = EXCLUDED.upside_target,
      downside_scenario = EXCLUDED.downside_scenario,
      downside_target = EXCLUDED.downside_target,
      risk_factors = EXCLUDED.risk_factors
  `;
  return { step: 'predictions', ...(await runWithTimeout(sql, [])) };
}
