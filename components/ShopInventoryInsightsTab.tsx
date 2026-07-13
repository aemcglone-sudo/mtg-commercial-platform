'use client';

import { useEffect, useState } from 'react';
import { CardNameLink } from '@/components/CardNameLink';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RarityMargin {
  rarity: string;
  marginCents: number;
  pct: number;
}

interface OverviewData {
  inventoryValueCents: number;
  costBasisCents: number;
  potentialMarginCents: number;
  potentialMarginPct: number;
  turnoverRatePct: number;
  totalUnits: number;
  unitsSoldThisMonth: number;
  rarityMargin: RarityMargin[];
}

interface TopSeller {
  cardName: string;
  unitsSold: number;
  revenueCents: number;
}

interface RecentSale {
  cardName: string;
  condition: string;
  priceCents: number;
  soldAt: string;
}

interface DeadStockItem {
  id: string;
  cardName: string;
  condition: string;
  quantity: number;
  priceCents: number;
  daysIdle: number;
}

interface VelocityData {
  topSellersByUnits: TopSeller[];
  topSellersByRevenue: TopSeller[];
  recentlySold: RecentSale[];
  deadStock: DeadStockItem[];
  deadStockTotal: { count: number; valueCents: number };
  avgDaysToSell: Array<{ tier: string; avgDays: number }>;
}

interface PricingGapItem {
  inventoryId: string;
  cardName: string;
  condition: string;
  yourPriceCents: number;
  tcgCents: number;
  gapPct: number;
}

interface GainerItem {
  cardName: string;
  condition: string;
  boughtAtCents: number;
  marketNowCents: number;
  gainCents: number;
  gainPct: number;
}

interface LoserItem {
  cardName: string;
  condition: string;
  boughtAtCents: number;
  marketNowCents: number;
  lossCents: number;
  lossPct: number;
}

interface PricingData {
  underpriced: PricingGapItem[];
  overpriced: PricingGapItem[];
  gainers: GainerItem[];
  losers: LoserItem[];
}

interface PerformanceSummary {
  revenueCents: number;
  costCents: number;
  grossProfitCents: number;
  avgMarginPct: number;
  targetMarginPct: number;
  orderCount: number;
}

interface MonthlyPerf {
  month: string;
  year: number;
  revenueCents: number;
  costCents: number;
  grossProfitCents: number;
  marginPct: number;
}

interface BestBuyItem {
  cardName: string;
  condition: string;
  paidCents: number;
  marketNowCents: number;
  gainCents: number;
  gainPct: number;
}

interface WorstBuyItem {
  cardName: string;
  condition: string;
  paidCents: number;
  marketNowCents: number;
  lossCents: number;
  lossPct: number;
}

interface SourceItem {
  source: string;
  totalCents: number;
  pct: number;
}

interface PerformanceData {
  summary: PerformanceSummary;
  monthly: MonthlyPerf[];
  bestBuys: BestBuyItem[];
  worstBuys: WorstBuyItem[];
  bySource: SourceItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const RARITY_COLORS: Record<string, string> = {
  mythic: 'bg-orange-500',
  rare: 'bg-yellow-400',
  uncommon: 'bg-blue-400',
  common: 'bg-zinc-500',
  unknown: 'bg-zinc-600',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-1">
      <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-xl font-bold tabular-nums text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-500 tabular-nums">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-zinc-500 font-medium">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-tight ${valueClass ?? 'text-zinc-100'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 leading-tight">{sub}</p>}
    </div>
  );
}

function GroupCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="divide-y divide-zinc-800/70">
        {children}
      </div>
    </div>
  );
}

function GroupSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className ?? ''}`}>{children}</div>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">{children}</h2>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24 text-zinc-600 text-sm">
      <svg className="w-5 h-5 animate-spin text-amber-400 mr-3" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
      Loading insights…
    </div>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  const label = condition || '—';
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  'Walk-in purchases': 'bg-zinc-500',
  'Collection buys': 'bg-amber-400',
  'Other': 'bg-zinc-700',
  'Unknown': 'bg-zinc-700',
};

export default function ShopInventoryInsightsTab() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [velocity, setVelocity] = useState<VelocityData | null>(null);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [period, setPeriod] = useState<'30' | '60' | '90'>('30');
  const [chartMonths, setChartMonths] = useState<3 | 6 | 12>(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [ovRes, velRes, priceRes, perfRes] = await Promise.all([
          fetch('/api/shops/insights/overview'),
          fetch('/api/shops/insights/velocity'),
          fetch('/api/shops/insights/pricing'),
          fetch(`/api/shops/insights/performance?period=${period}&months=${chartMonths}`),
        ]);
        if (!ovRes.ok || !velRes.ok) throw new Error('Failed to load insights');
        const [ov, vel] = await Promise.all([ovRes.json(), velRes.json()]) as [OverviewData, VelocityData];
        setOverview(ov);
        setVelocity(vel);
        // Pricing is best-effort — don't crash if it fails
        if (priceRes.ok) {
          const priceData = await priceRes.json() as PricingData;
          setPricing(priceData);
        } else {
          setPricing({ underpriced: [], overpriced: [], gainers: [], losers: [] });
        }
        // Performance is best-effort
        if (perfRes.ok) {
          setPerformance(await perfRes.json() as PerformanceData);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch performance when period or chart horizon changes
  useEffect(() => {
    if (loading) return;
    fetch(`/api/shops/insights/performance?period=${period}&months=${chartMonths}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: PerformanceData | null) => { if (data) setPerformance(data); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, chartMonths]);

  if (loading) return <Spinner />;
  if (error) return <div className="py-12 text-center text-red-400 text-sm">{error}</div>;
  if (!overview || !velocity) return null;

  const pricingData = pricing ?? { underpriced: [], overpriced: [], gainers: [], losers: [] };

  const {
    inventoryValueCents,
    costBasisCents,
    potentialMarginCents,
    potentialMarginPct,
    turnoverRatePct,
    totalUnits,
    unitsSoldThisMonth,
    rarityMargin,
  } = overview;

  const costPct = inventoryValueCents > 0 ? (costBasisCents / inventoryValueCents) * 100 : 0;
  const marginPct = inventoryValueCents > 0 ? (potentialMarginCents / inventoryValueCents) * 100 : 0;

  return (
    <div className="space-y-8">
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
      {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
      <div className="space-y-8">

      {/* ── Section 1: Inventory Health ─────────────────────────────────── */}
      <GroupCard title="Inventory Health" description="A snapshot of what your stock is worth right now — and how much profit you could make if you sold everything.">
        <GroupSection>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <MiniStat label="Total Stock Value" value={fmt(inventoryValueCents)} sub="What you could sell it all for" />
            <MiniStat label="What You Paid" value={fmt(costBasisCents)} sub="Your total cost to buy this stock" />
            <MiniStat label="Potential Profit" value={fmt(potentialMarginCents)} sub={`${potentialMarginPct.toFixed(1)}% margin if you sold everything`} />
            <MiniStat label="Sell-Through Rate" value={`${turnoverRatePct.toFixed(1)}%/mo`} sub={`${unitsSoldThisMonth} sold of ${totalUnits.toLocaleString()} in stock`} />
          </div>
        </GroupSection>
        <GroupSection>
          <p className="text-xs font-semibold text-zinc-300 mb-1">Where your money is</p>
          <p className="text-xs text-zinc-500 mb-3">The gray bar is what you spent buying cards. The gold bar is the profit sitting in your inventory waiting to be unlocked.</p>
          <div className="flex justify-between text-xs text-zinc-500 tabular-nums mb-1.5">
            <span>You paid · {fmt(costBasisCents)} ({costPct.toFixed(1)}%)</span>
            <span>Profit waiting · {fmt(potentialMarginCents)} ({marginPct.toFixed(1)}%)</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex bg-zinc-800">
            <div className="bg-zinc-600 transition-all" style={{ width: `${Math.min(costPct, 100)}%` }} />
            <div className="bg-amber-400 transition-all" style={{ width: `${Math.min(marginPct, 100)}%` }} />
          </div>
          {rarityMargin.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-300 mb-1">Profit by rarity — which tier drives the most value</p>
              {rarityMargin.map(r => {
                const barPct = Math.max(0, Math.min(r.pct, 100));
                const color = RARITY_COLORS[r.rarity.toLowerCase()] ?? 'bg-zinc-500';
                return (
                  <div key={r.rarity} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-zinc-400 capitalize">{r.rarity}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="w-24 text-xs text-zinc-400 text-right tabular-nums">{fmt(r.marginCents)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </GroupSection>
      </GroupCard>

      {/* ── Section 2: What's Selling ────────────────────────────────────── */}
      <GroupCard title="What's Selling" description="See which cards are flying off the shelf and which ones haven't moved in a while.">
        <GroupSection>
          <p className="text-xs font-semibold text-zinc-300 mb-0.5">Top sellers — last 30 days</p>
          <p className="text-xs text-zinc-500 mb-3">Left: cards sold most often. Right: cards that brought in the most cash.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 font-medium mb-2">Most copies sold</p>
              {velocity.topSellersByUnits.length === 0 ? <p className="text-zinc-600 text-sm">No sales yet.</p> : (
                <ol className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {velocity.topSellersByUnits.map((s, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="text-zinc-600 w-3 shrink-0">{i + 1}.</span>
                      <span className="flex-1 text-zinc-200 truncate"><CardNameLink name={s.cardName} /></span>
                      <span className="text-zinc-500 shrink-0">{s.unitsSold}×</span>
                      <span className="text-amber-400 shrink-0">{fmt(s.revenueCents)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-medium mb-2">Most money made</p>
              {velocity.topSellersByRevenue.length === 0 ? <p className="text-zinc-600 text-sm">No sales yet.</p> : (
                <ol className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {velocity.topSellersByRevenue.map((s, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="text-zinc-600 w-3 shrink-0">{i + 1}.</span>
                      <span className="flex-1 text-zinc-200 truncate"><CardNameLink name={s.cardName} /></span>
                      <span className="text-zinc-500 shrink-0">{s.unitsSold}×</span>
                      <span className="text-amber-400 shrink-0">{fmt(s.revenueCents)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </GroupSection>
        <GroupSection>
          <p className="text-xs font-semibold text-zinc-300 mb-0.5">Recently sold</p>
          <p className="text-xs text-zinc-500 mb-3">Your latest sales — useful for spotting demand trends as they happen.</p>
          {velocity.recentlySold.length === 0 ? (
            <p className="text-zinc-600 text-sm">No fulfilled orders yet.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {velocity.recentlySold.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-zinc-200 truncate"><CardNameLink name={s.cardName} /></span>
                  <ConditionBadge condition={s.condition} />
                  <span className="text-amber-400 tabular-nums shrink-0">{fmt(s.priceCents)}</span>
                  <span className="text-zinc-600 tabular-nums shrink-0">{relativeTime(s.soldAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </GroupSection>
        <GroupSection>
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-semibold text-zinc-300">Cards that aren&apos;t moving</p>
            {velocity.deadStockTotal.count > 0 && (
              <span className="text-xs text-zinc-500 tabular-nums shrink-0 ml-2">{velocity.deadStockTotal.count} cards · {fmt(velocity.deadStockTotal.valueCents)} tied up</span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mb-3">Haven&apos;t sold in 60+ days. Consider dropping the price to free up cash. ⚠ means over 90 days idle.</p>
          {velocity.deadStock.length === 0 ? (
            <p className="text-zinc-600 text-sm">No dead stock — great turnover!</p>
          ) : (
            <div className="overflow-auto max-h-52">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left pb-2 font-medium">Card</th>
                    <th className="text-left pb-2 font-medium">Cond</th>
                    <th className="text-right pb-2 font-medium">Qty</th>
                    <th className="text-right pb-2 font-medium">Value</th>
                    <th className="text-right pb-2 font-medium">Idle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {velocity.deadStock.map(item => (
                    <tr key={item.id} className="text-zinc-300">
                      <td className="py-1.5 pr-2 max-w-[160px] truncate"><CardNameLink name={item.cardName} /></td>
                      <td className="py-1.5 pr-2"><ConditionBadge condition={item.condition} /></td>
                      <td className="py-1.5 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-1.5 text-right tabular-nums text-amber-400">{fmt(item.priceCents)}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        <span className={item.daysIdle > 90 ? 'text-red-400' : 'text-zinc-400'}>
                          {item.daysIdle > 90 && <span className="mr-0.5" title="Over 90 days idle">⚠</span>}
                          {item.daysIdle}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GroupSection>
      </GroupCard>

      </div>{/* end left column */}

      {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
      <div className="space-y-8">

      {/* ── Section 4: Buy vs. Sell Performance ─────────────────────────── */}
      <GroupCard title="How Is the Business Doing?" description="Track whether your shop is making money — and whether it's improving over time.">
        {!performance ? (
          <GroupSection>
            <p className="text-zinc-500 text-sm text-center py-4">No performance data yet</p>
          </GroupSection>
        ) : (() => {
          const { summary, monthly, bestBuys, worstBuys, bySource } = performance;

          // ── Summary stat row ──
          const marginColor =
            summary.avgMarginPct >= summary.targetMarginPct
              ? 'text-green-400'
              : summary.avgMarginPct >= summary.targetMarginPct - 5
              ? 'text-amber-400'
              : 'text-red-400';

          // ── SVG chart helpers ──
          const PLOT_X0 = 60, PLOT_X1 = 580, PLOT_Y0 = 20, PLOT_Y1 = 160;
          const PLOT_W = PLOT_X1 - PLOT_X0;
          const PLOT_H = PLOT_Y1 - PLOT_Y0;

          function fmtY(cents: number): string {
            if (cents >= 100000) return '$' + (cents / 100000).toFixed(1) + 'k';
            return '$' + Math.round(cents / 100).toLocaleString('en-US');
          }

          // Chart 1 — Revenue vs Cost
          const maxRevCost = monthly.length > 0
            ? Math.max(...monthly.map(m => Math.max(m.revenueCents, m.costCents))) * 1.1
            : 1;

          function toRevCostPoint(i: number, val: number) {
            const x = monthly.length === 1
              ? (PLOT_X0 + PLOT_X1) / 2
              : PLOT_X0 + (i / (monthly.length - 1)) * PLOT_W;
            const y = PLOT_Y1 - (val / maxRevCost) * PLOT_H;
            return { x, y };
          }

          const revPoints = monthly.map((m, i) => toRevCostPoint(i, m.revenueCents));
          const costPoints = monthly.map((m, i) => toRevCostPoint(i, m.costCents));

          function polyline(pts: { x: number; y: number }[]) {
            if (pts.length === 0) return '';
            return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          }

          function fillPath(pts: { x: number; y: number }[]) {
            if (pts.length === 0) return '';
            const last = pts[pts.length - 1];
            const first = pts[0];
            return `${polyline(pts)} L ${last.x.toFixed(1)} ${PLOT_Y1} L ${first.x.toFixed(1)} ${PLOT_Y1} Z`;
          }

          const gridYs = [PLOT_Y0, 60, 100, 140, PLOT_Y1];
          const gridVals = gridYs.map(y => Math.round((1 - (y - PLOT_Y0) / PLOT_H) * maxRevCost));

          // Chart 2 — Margin %
          const MARGIN_Y0 = 15, MARGIN_Y1 = 130;
          const MARGIN_H = MARGIN_Y1 - MARGIN_Y0;
          const MAX_MARGIN = 80;

          function toMarginPoint(i: number, pct: number) {
            const x = monthly.length === 1
              ? (PLOT_X0 + PLOT_X1) / 2
              : PLOT_X0 + (i / (monthly.length - 1)) * PLOT_W;
            const y = MARGIN_Y1 - (Math.min(pct, MAX_MARGIN) / MAX_MARGIN) * MARGIN_H;
            return { x, y };
          }

          const marginPoints = monthly.map((m, i) => toMarginPoint(i, m.marginPct));
          const targetY = MARGIN_Y1 - (summary.targetMarginPct / MAX_MARGIN) * MARGIN_H;

          return (
            <>
              {/* Summary card with period toggle */}
              <GroupSection className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 whitespace-nowrap">Summary covers last</span>
                  <div className="flex gap-1">
                    {(['30', '60', '90'] as const).map(p => (
                      <button key={p} type="button" onClick={() => setPeriod(p)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${period === p ? 'bg-amber-400 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                        {p} days
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <MiniStat label="Total Sales" value={fmt(summary.revenueCents)} sub="Money collected from customers" />
                  <MiniStat label="Profit" value={fmt(summary.grossProfitCents)} sub="What's left after paying for your cards" />
                  <MiniStat label="Profit Margin" value={`${summary.avgMarginPct.toFixed(1)}%`} sub={`You keep ${summary.avgMarginPct.toFixed(0)}¢ per $1 sold — target is ${summary.targetMarginPct}¢`} valueClass={marginColor} />
                  <MiniStat label="Orders Filled" value={summary.orderCount.toLocaleString()} sub="Sales transactions completed" />
                </div>
              </GroupSection>

              {/* Charts card with chart months toggle */}
              <GroupSection className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 whitespace-nowrap">Charts show last</span>
                  <div className="flex gap-1">
                    {([3, 6, 12] as const).map(m => (
                      <button key={m} type="button" onClick={() => setChartMonths(m)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${chartMonths === m ? 'bg-amber-400 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                        {m}mo
                      </button>
                    ))}
                  </div>
                </div>

              {/* Chart 1 — Revenue vs Cost Basis */}
              <div>
                <p className="text-sm font-semibold text-zinc-200 mb-0.5">Sales vs. What You Paid</p>
                <p className="text-xs text-zinc-500 mb-4">The gold line is money coming in from sales. The dashed line is what you originally paid for those cards. The bigger the gap between the lines, the more profit you&apos;re making.</p>
                {monthly.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No fulfilled order data yet.</p>
                ) : (
                  <>
                    <svg viewBox="0 0 640 200" className="w-full overflow-visible">
                      <defs>
                        <linearGradient id="perfGradient1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Grid lines */}
                      {gridYs.map((gy, i) => (
                        <g key={i}>
                          <line x1={PLOT_X0} y1={gy} x2={PLOT_X1} y2={gy} stroke="#3f3f46" strokeWidth="1" />
                          <text x={PLOT_X0 - 4} y={gy + 4} textAnchor="end" fontSize="9" fill="#71717a">
                            {fmtY(gridVals[i])}
                          </text>
                        </g>
                      ))}
                      {/* Revenue fill */}
                      {revPoints.length > 0 && (
                        <path d={fillPath(revPoints)} fill="url(#perfGradient1)" />
                      )}
                      {/* Revenue line */}
                      {revPoints.length > 0 && (
                        <path d={polyline(revPoints)} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" />
                      )}
                      {/* Cost line */}
                      {costPoints.length > 0 && (
                        <path d={polyline(costPoints)} fill="none" stroke="#71717a" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />
                      )}
                      {/* Data points & labels */}
                      {monthly.map((m, i) => {
                        const rp = revPoints[i];
                        const cp = costPoints[i];
                        return (
                          <g key={i}>
                            <circle cx={rp.x} cy={rp.y} r="3" fill="#fbbf24" />
                            <circle cx={cp.x} cy={cp.y} r="3" fill="#71717a" />
                            <text x={rp.x} y={PLOT_Y1 + 14} textAnchor="middle" fontSize="9" fill="#a1a1aa">
                              {m.month}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    {/* Legend */}
                    <div className="flex gap-4 mt-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-6 h-0.5 bg-amber-400" />
                        Revenue
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-6 border-t border-dashed border-zinc-500" />
                        Cost Basis
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Chart 2 — Margin % */}
              <div className="border-t border-zinc-800 pt-4">
                <p className="text-sm font-semibold text-zinc-200 mb-0.5">Profit Margin Over Time</p>
                <p className="text-xs text-zinc-500 mb-4">Shows what percentage of each sale you kept as profit, month by month. The dashed line is your 40% target — stay above it and the business is healthy. Below it means you&apos;re buying cards at too high a price or selling too cheaply.</p>
                {monthly.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No fulfilled order data yet.</p>
                ) : (
                  <svg viewBox="0 0 640 150" className="w-full overflow-visible">
                    <defs>
                      <linearGradient id="perfGradient2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0, 20, 40, 60, 80].map(pct => {
                      const gy = MARGIN_Y1 - (pct / MAX_MARGIN) * MARGIN_H;
                      return (
                        <g key={pct}>
                          <line x1={PLOT_X0} y1={gy} x2={PLOT_X1} y2={gy} stroke="#3f3f46" strokeWidth="1" />
                          <text x={PLOT_X0 - 4} y={gy + 4} textAnchor="end" fontSize="9" fill="#71717a">{pct}%</text>
                        </g>
                      );
                    })}
                    <line x1={PLOT_X0} y1={targetY} x2={PLOT_X1} y2={targetY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
                    <text x={PLOT_X1 + 4} y={targetY + 4} fontSize="9" fill="#f59e0b">Target 40%</text>
                    {marginPoints.length > 0 && (
                      <path d={fillPath(marginPoints)} fill="#fbbf24" fillOpacity="0.15" />
                    )}
                    {marginPoints.length > 0 && (
                      <path d={polyline(marginPoints)} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" />
                    )}
                    {monthly.map((m, i) => {
                      const mp = marginPoints[i];
                      return (
                        <g key={i}>
                          <circle cx={mp.x} cy={mp.y} r="3" fill="#fbbf24" />
                          <text x={mp.x} y={MARGIN_Y1 + 14} textAnchor="middle" fontSize="9" fill="#a1a1aa">
                            {m.month}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
              </GroupSection>

              {/* Best Buys / Worst Buys side by side */}
              <GroupSection>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-zinc-800">
                  <div className="p-4">
                    <p className="text-xs font-semibold text-zinc-300 mb-0.5">🏆 Best Buys</p>
                    <p className="text-xs text-zinc-500 mb-3">Cards you bought that went up the most in value.</p>
                    {bestBuys.length === 0 ? <p className="text-zinc-600 text-xs">No data yet.</p> : (
                      <table className="w-full text-xs">
                        <thead><tr className="text-zinc-500 border-b border-zinc-800">
                          <th className="text-left pb-1.5 font-medium">Card</th>
                          <th className="text-right pb-1.5 font-medium">Paid</th>
                          <th className="text-right pb-1.5 font-medium text-green-400">Gain</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {bestBuys.map((item, i) => (
                            <tr key={i} className="text-zinc-300">
                              <td className="py-1.5 pr-1 max-w-[100px] truncate"><CardNameLink name={item.cardName} /></td>
                              <td className="py-1.5 text-right tabular-nums text-zinc-500">{fmt(item.paidCents)}</td>
                              <td className="py-1.5 text-right tabular-nums text-green-400">+{item.gainPct.toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold text-zinc-300 mb-0.5">📉 Worst Buys</p>
                    <p className="text-xs text-zinc-500 mb-3">Cards that lost value since you bought them.</p>
                    {worstBuys.length === 0 ? <p className="text-zinc-600 text-xs">No data yet.</p> : (
                      <table className="w-full text-xs">
                        <thead><tr className="text-zinc-500 border-b border-zinc-800">
                          <th className="text-left pb-1.5 font-medium">Card</th>
                          <th className="text-right pb-1.5 font-medium">Paid</th>
                          <th className="text-right pb-1.5 font-medium text-red-400">Loss</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {worstBuys.map((item, i) => (
                            <tr key={i} className="text-zinc-300">
                              <td className="py-1.5 pr-1 max-w-[100px] truncate"><CardNameLink name={item.cardName} /></td>
                              <td className="py-1.5 text-right tabular-nums text-zinc-500">{fmt(item.paidCents)}</td>
                              <td className="py-1.5 text-right tabular-nums text-red-400">-{item.lossPct.toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
              </GroupSection>

              {bySource.length > 0 && (
                <GroupSection>
                  <p className="text-xs font-semibold text-zinc-300 mb-0.5">Where Your Stock Came From</p>
                  <p className="text-xs text-zinc-500 mb-3">How much you&apos;ve spent buying cards from each source. Know which channel is your biggest investment.</p>
                  <div className="space-y-2">
                    {bySource.map(s => {
                      const color = SOURCE_COLORS[s.source] ?? 'bg-zinc-600';
                      const widthPct = Math.round(Math.min(s.pct, 100));
                      const widthClass = `w-[${widthPct}%]`;
                      return (
                        <div key={s.source} className="flex items-center gap-3">
                          <span className="w-32 text-xs text-zinc-400 truncate">{s.source}</span>
                          <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                            <div className={`h-full rounded-full ${color} ${widthClass}`} />
                          </div>
                          <span className="w-20 text-xs text-zinc-400 text-right tabular-nums">{fmt(s.totalCents)}</span>
                        </div>
                      );
                    })}
                  </div>
                </GroupSection>
              )}
            </>
          );
        })()}
      </GroupCard>

      </div>{/* end right column */}
    </div>{/* end 2-col grid */}

    {/* ── Full-width: Your Prices vs. The Market ───────────────────────── */}
    <GroupCard title="Market Movement Since You Listed" description="Cards in your inventory whose market price has moved ≥5% since you first priced them. Refresh market prices from your inventory page to keep this current.">
      <GroupSection>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-zinc-300 mb-0.5">🚀 Went Up in Value</p>
            <p className="text-xs text-zinc-500 mb-3">Market rose above your listed price — consider repricing upward.</p>
            {pricingData.gainers.length === 0 ? <p className="text-zinc-600 text-xs">No movement detected — try refreshing market prices from your inventory page.</p> : (
              <div className="overflow-auto max-h-52"><table className="w-full text-xs">
                <thead><tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left pb-1.5 font-medium">Card</th>
                  <th className="text-right pb-1.5 font-medium">Listed At</th>
                  <th className="text-right pb-1.5 font-medium text-green-400">Market Now</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {pricingData.gainers.map((item, i) => (
                    <tr key={i} className="text-zinc-300">
                      <td className="py-1.5 pr-1 truncate"><CardNameLink name={item.cardName} /></td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-500">{fmt(item.boughtAtCents)}</td>
                      <td className="py-1.5 text-right tabular-nums text-green-400">+{item.gainPct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-300 mb-0.5">⚠ Dropped in Value</p>
            <p className="text-xs text-zinc-500 mb-3">Market fell below your listed price — you may be overpriced.</p>
            {pricingData.losers.length === 0 ? <p className="text-zinc-600 text-xs">No movement detected — try refreshing market prices from your inventory page.</p> : (
              <div className="overflow-auto max-h-52"><table className="w-full text-xs">
                <thead><tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left pb-1.5 font-medium">Card</th>
                  <th className="text-right pb-1.5 font-medium">Listed At</th>
                  <th className="text-right pb-1.5 font-medium text-red-400">Market Now</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {pricingData.losers.map((item, i) => (
                    <tr key={i} className="text-zinc-300">
                      <td className="py-1.5 pr-1 truncate"><CardNameLink name={item.cardName} /></td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-500">{fmt(item.boughtAtCents)}</td>
                      <td className="py-1.5 text-right tabular-nums text-red-400">-{item.lossPct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      </GroupSection>
    </GroupCard>

    </div>
  );
}
