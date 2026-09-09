import Link from 'next/link';
import BackButton from '@/components/BackButton';

interface SignalDoc {
  name: string;
  status: 'live' | 'experimental';
  summary: string;
  detail: string;
  seeAlso?: { href: string; label: string };
}

const SIGNALS: SignalDoc[] = [
  {
    name: 'Momentum (7d / 30d / 90d)',
    status: 'live',
    summary: '% price change over the last 7, 30, and 90 days.',
    detail: 'The simplest signal: today\'s price vs. the price exactly 7/30/90 days ago, as a percentage. Positive momentum means the card has been climbing; negative means it\'s been sliding. Computed daily for every tracked card in market_signals.',
    seeAlso: { href: '/market/scoreboard', label: 'Speculation Scoreboard' },
  },
  {
    name: 'Release Phase',
    status: 'live',
    summary: 'Where a card is in its post-release price lifecycle: presale, hype spike, supply flood, stabilizing, or mature.',
    detail: 'Based on days since the card\'s set released — presale (before release), hype spike (0–7 days), supply flood (7–21 days, prices often dip as more copies enter circulation), stabilizing (21–90 days), mature (90+ days). New sets predictably follow this curve; knowing the phase helps separate "this is just supply-flood noise" from "this is a real move."',
  },
  {
    name: '52-Week High / Low',
    status: 'live',
    summary: 'The highest and lowest price a card has traded at in the last year.',
    detail: 'Gives current price context — a card at its 52-week low might be a buying opportunity or might be justifiably down. Computed as a single grouped scan over the last 365 days of snapshots (an earlier per-card subquery version was expensive enough to contribute to real database strain — see the daily sync incident).',
  },
  {
    name: 'Price vs. Set Median',
    status: 'live',
    summary: 'How a card\'s price compares to the median price of every other card in its set, as a multiple.',
    detail: 'A card priced at 5.0× its set\'s median is a chase card for that set; near 1.0× is a bulk-tier card. Useful for spotting cards that are unusually expensive (or cheap) relative to their own printing, not just in absolute dollars.',
  },
  {
    name: 'Foil Premium',
    status: 'live',
    summary: 'How much more (or less) the foil version of a card sells for than the nonfoil, averaged per set.',
    detail: 'Computed as AVG(foil price) vs AVG(nonfoil price) across every card in a set with enough tracked data (10+ cards). Most sets show a clear foil premium, but it varies a lot — and for some newer sets, foil can trade at or below nonfoil, which is the specific pattern that prompted building this page.',
    seeAlso: { href: '/market/foil-premium', label: 'Foil Premium' },
  },
  {
    name: 'Popularity vs. Price (EDHREC)',
    status: 'experimental',
    summary: 'Whether a card\'s EDHREC inclusion rate (how often it\'s played in a given commander\'s deck) moving predicts its price moving.',
    detail: 'We snapshot EDHREC\'s per-commander inclusion rate daily for ~20 popular commanders and track it alongside each card\'s price. Marked experimental because it needs real history to say anything — day one only shows today\'s snapshot with no trend yet; the "popularity Δ" and "price Δ" columns fill in as more days accumulate (weeks, ideally) and become the actual point of the page: does a card climbing in EDHREC precede it climbing in price, or does price react to something else entirely?',
    seeAlso: { href: '/market/popularity', label: 'Popularity vs Price' },
  },
  {
    name: 'Volatility (7d / 30d)',
    status: 'experimental',
    summary: 'Standard deviation of daily % price change — how choppy a card\'s price has been, independent of direction.',
    detail: 'Built but not yet running in the daily sync. The straightforward version (a LAG() window function over 30 days of history for every eligible card) was expensive enough at scale to strain the database, so it\'s parked until it\'s rewritten to be cheaper — a smaller window or an incrementally-maintained daily-returns table are the likely fixes. Listed here for transparency about what exists in code vs. what\'s actually live.',
  },
];

function StatusBadge({ status }: { status: SignalDoc['status'] }) {
  return status === 'live' ? (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 uppercase tracking-wide">Live</span>
  ) : (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-400 uppercase tracking-wide">Experimental</span>
  );
}

export default function SignalsGlossaryPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Market Signals</h1>
          <p className="text-sm text-zinc-500 mt-0.5">What we actually track to make sense of card price movement, and how each one works.</p>
        </div>
        <BackButton fallbackHref="/market" />
      </div>
      <p className="text-xs text-zinc-600 mt-1 mb-6">
        This grows as we add new signals. "Live" means it's computed daily and feeding predictions or a page today;
        "Experimental" means the code exists and runs, but needs more history (or more optimization) before it's
        something you should lean on.
      </p>

      <div className="space-y-4">
        {SIGNALS.map(s => (
          <div key={s.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
              <h2 className="font-semibold text-zinc-100">{s.name}</h2>
              <StatusBadge status={s.status} />
            </div>
            <p className="text-sm text-zinc-300 mb-2">{s.summary}</p>
            <p className="text-xs text-zinc-500 leading-relaxed">{s.detail}</p>
            {s.seeAlso && (
              <Link href={s.seeAlso.href} className="inline-block mt-3 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                See it in action: {s.seeAlso.label} →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mt-6">
        <h2 className="font-semibold text-zinc-100 mb-1.5">How predictions use these</h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          The 6-month price predictions on each card's page don't add a new signal of their own — they pattern-match a card's
          current combination of the signals above against how similar cards have historically moved, and surface which
          signals were most influential in that call (shown as "dominant signals" on the prediction).
        </p>
      </div>
    </main>
  );
}
