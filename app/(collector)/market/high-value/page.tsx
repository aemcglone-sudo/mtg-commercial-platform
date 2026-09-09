'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Sparkline from '@/components/Sparkline';
import BackButton from '@/components/BackButton';
import PriceChange from '@/components/PriceChange';

interface Event {
  scryfallId: string; category: string; summary: string; sourceUrls: string[]; detectedAt: string;
}
interface HighValueCard {
  scryfallId: string; cardName: string; setCode: string; usd: number; sparkline: number[];
  latestEvent: Event | null;
}
interface CategoryCard { scryfallId: string; cardName: string; setCode: string; usd: number }
interface CategoryHighValue { category: string; cards: CategoryCard[] }

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  reprint: 'Reprint', banned: 'Ban/Unban', tournament: 'Tournament result', set_synergy: 'New set synergy', other: 'News',
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pctChange(sparkline: number[]): number | null {
  if (sparkline.length < 2) return null;
  const first = sparkline[0];
  const last = sparkline[sparkline.length - 1];
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

export default function HighValueCardsPage() {
  const [cards, setCards] = useState<HighValueCard[] | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryHighValue[] | null>(null);
  const [setNameByCode, setSetNameByCode] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<'all' | 'news'>('all');
  const [sort, setSort] = useState<'price' | 'change'>('price');

  const load = useCallback(async () => {
    const [hvRes, catRes, setsRes] = await Promise.all([
      fetch('/api/market/high-value').then(r => r.json()),
      fetch('/api/market/high-value/categories').then(r => r.json()),
      fetch('/api/market/sets?all=1').then(r => r.json()),
    ]);
    setCards(hvRes.cards ?? []);
    setComputedAt(hvRes.computedAt ?? null);
    setCategories(catRes.categories ?? []);
    setSetNameByCode(new Map((setsRes.sets ?? []).map((s: any) => [s.code, s.name])));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setName = useCallback((code: string) => setNameByCode.get(code) ?? code.toUpperCase(), [setNameByCode]);

  const cardsWithNews = useMemo(() => (cards ?? []).filter(c => c.latestEvent !== null), [cards]);

  const visibleCards = useMemo(() => {
    if (!cards) return [];
    let rows = filter === 'news' ? cards.filter(c => c.latestEvent !== null) : cards;
    rows = [...rows].sort((a, b) => sort === 'price'
      ? b.usd - a.usd
      : (pctChange(b.sparkline) ?? -Infinity) - (pctChange(a.sparkline) ?? -Infinity));
    return rows;
  }, [cards, filter, sort]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold">Highest Value Cards</h1>
          <p className="text-sm text-zinc-500 mt-0.5">The most expensive tracked Magic cards, and what's moving them.</p>
        </div>
        <BackButton fallbackHref="/market" />
      </div>
      <p className="text-xs text-zinc-600 mb-1">
        Ranked by current price across the whole tracked catalog (not one set).
        {computedAt && ` Last updated ${new Date(computedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`}
      </p>
      <p className="text-xs text-amber-600/80 mb-6">
        ⚠ Not the same as "the most valuable Magic cards ever" — this only ranks cards our data source (TCGPlayer, via Scryfall) actually has a market price for.
        The rarest originals (Alpha/Beta Power Nine — original Black Lotus, Ancestral Recall, Time Walk, etc.) mostly aren't included here at all, because they don't
        trade on typical retail marketplaces and genuinely have no tracked price anywhere we can pull from — they sell via auction houses and private sales instead,
        often for far more than anything shown below. What you see here is real, current, and honest for what it is; it just isn't the complete "most valuable ever" picture.
      </p>

      {cardsWithNews.length > 0 && (
        <div className="bg-sky-950/20 border border-sky-900/50 rounded-xl p-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-sky-400 font-semibold mb-2">Recent news among these cards</p>
          <div className="space-y-2">
            {cardsWithNews.slice(0, 5).map(c => (
              <div key={c.scryfallId} className="text-sm">
                <span className="text-sky-400 text-xs font-medium mr-1.5">{EVENT_CATEGORY_LABELS[c.latestEvent!.category] ?? c.latestEvent!.category}</span>
                <Link href={`/market/card/${c.scryfallId}`} className="hover:text-amber-400 transition-colors font-medium">{c.cardName}</Link>
                <span className="text-zinc-400"> — {c.latestEvent!.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cards === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {cards !== null && cards.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-400">
          No data yet — it's computed once a day by the price sync job.
        </div>
      )}

      {cards !== null && cards.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2 p-4 border-b border-zinc-800">
            <div className="flex items-center gap-1.5">
              {([{ key: 'all', label: 'All' }, { key: 'news', label: 'With news' }] as { key: 'all' | 'news'; label: string }[]).map(f => (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.key ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              Sort by
              <button type="button" onClick={() => setSort('price')} className={sort === 'price' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>Price</button>
              ·
              <button type="button" onClick={() => setSort('change')} className={sort === 'change' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-300'}>30d change</button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">30d trend</th>
                  <th className="px-4 py-3 font-medium">Price / 30d change</th>
                  <th className="px-4 py-3 font-medium">News</th>
                </tr>
              </thead>
              <tbody>
                {visibleCards.map((c, i) => {
                  const change = pctChange(c.sparkline);
                  return (
                    <tr key={c.scryfallId} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40">
                      <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/market/card/${c.scryfallId}`} className="hover:text-amber-400 transition-colors">
                          {c.cardName}
                          <span className="text-zinc-500 text-xs"> — {setName(c.setCode)}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {c.sparkline.length >= 2
                          ? <Sparkline values={c.sparkline} positive={(change ?? 0) >= 0} width={100} height={24} />
                          : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {change !== null ? (
                          <PriceChange price={c.usd} changeAbs={c.usd - c.sparkline[0]} changePct={change} />
                        ) : (
                          <span className="text-zinc-200 font-medium">{fmtUsd(c.usd)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 max-w-[220px]">
                        {c.latestEvent ? (
                          <span title={c.latestEvent.summary} className="text-sky-400">
                            {EVENT_CATEGORY_LABELS[c.latestEvent.category] ?? c.latestEvent.category}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-zinc-600 p-3 border-t border-zinc-800">{visibleCards.length} of {cards.length} shown — scroll within the list above for more.</p>
        </div>
      )}

      {categories !== null && categories.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-1">Highest Value by Category</h2>
          <p className="text-xs text-zinc-600 mb-4">
            Same "priciest cards we have real market data for" caveat as above — broken down by card type.
            "Legendary" cross-cuts the type categories (a card can be both, e.g. a Legendary Creature).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.category} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-amber-500 font-semibold mb-2">{cat.category}</p>
                <div className="space-y-1.5">
                  {cat.cards.map((c, i) => (
                    <Link key={c.scryfallId} href={`/market/card/${c.scryfallId}`} className="flex items-center justify-between gap-2 text-sm hover:text-amber-400 transition-colors">
                      <span className="truncate"><span className="text-zinc-600 mr-1">{i + 1}.</span>{c.cardName}</span>
                      <span className="text-zinc-500 text-xs shrink-0">{fmtUsd(c.usd)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {categories !== null && categories.length === 0 && (
        <p className="text-xs text-zinc-600 mt-8">
          No category breakdown yet — this needs a card-type field (type_line) that just started being captured; it'll populate as today's sync completes.
        </p>
      )}
    </main>
  );
}
