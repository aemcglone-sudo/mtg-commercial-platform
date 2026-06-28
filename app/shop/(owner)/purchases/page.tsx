'use client';

import { useEffect, useState } from 'react';
import { CardNameLink } from '@/components/CardNameLink';
import Link from 'next/link';

interface Purchase {
  id: string;
  sellerName: string | null;
  sellerContact: string | null;
  totalPaidCents: number;
  notes: string | null;
  status: string;
  createdAt: string;
  itemCount: number;
}

interface PurchaseItem {
  id: string;
  cardName: string;
  setCode: string;
  condition: string;
  foil: boolean;
  quantity: number;
  buyPriceCents: number;
  tcgMarketCents: number;
  targetSellPriceCents: number | null;
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ [id: string]: PurchaseItem[] }>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/shops/purchases')
      .then(r => r.json())
      .then((d: { purchases: Purchase[] }) => setPurchases(d.purchases ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (detail[id]) return;
    setLoadingDetail(id);
    try {
      const res = await fetch(`/api/shops/purchases/${id}`);
      const d = await res.json() as { items: PurchaseItem[] };
      setDetail(prev => ({ ...prev, [id]: d.items ?? [] }));
    } finally { setLoadingDetail(null); }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Purchase History</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Cards bought from sellers, confirmed via the Buy tab.</p>
          </div>
          <Link href="/shop/pricing?tab=buy" className="text-sm text-zinc-500 hover:text-amber-400 transition-colors">
            ← Back to Buy
          </Link>
        </div>

        {loading && (
          <div className="text-zinc-500 text-sm py-12 text-center">Loading…</div>
        )}

        {!loading && purchases.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-3">
            <div className="text-zinc-600 text-sm">No purchases recorded yet.</div>
            <Link href="/shop/pricing?tab=buy"
              className="inline-block text-xs text-amber-400 hover:text-amber-300 transition-colors">
              Go to Buy tab →
            </Link>
          </div>
        )}

        {!loading && purchases.length > 0 && (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Seller</th>
                  <th className="text-right px-4 py-3 text-zinc-400 font-medium">Cards</th>
                  <th className="text-right px-4 py-3 text-zinc-400 font-medium">Total Paid</th>
                  <th className="text-right px-4 py-3 text-zinc-400 font-medium">Status</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <>
                    <tr
                      key={p.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(p.id)}
                    >
                      <td className="px-4 py-3 text-zinc-400 tabular-nums text-xs">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-200">
                        {p.sellerName ?? <span className="text-zinc-600 italic">Anonymous</span>}
                        {p.sellerContact && (
                          <div className="text-xs text-zinc-600">{p.sellerContact}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">{p.itemCount}</td>
                      <td className="px-4 py-3 text-right text-zinc-200 font-medium tabular-nums">{fmt(p.totalPaidCents)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-900/30 text-green-400 border border-green-800/40">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-600 text-xs">
                        {expandedId === p.id ? '▲' : '▼'}
                      </td>
                    </tr>

                    {expandedId === p.id && (
                      <tr key={`${p.id}-detail`} className="border-b border-zinc-800/50 bg-zinc-900/30">
                        <td colSpan={6} className="px-4 py-4">
                          {loadingDetail === p.id && (
                            <div className="text-zinc-600 text-xs py-2">Loading…</div>
                          )}
                          {detail[p.id] && (
                            <div className="space-y-3">
                              {p.notes && (
                                <p className="text-xs text-zinc-500 italic">{p.notes}</p>
                              )}
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-zinc-700">
                                    <th className="text-left pb-2 text-zinc-500 font-medium pr-4">Card</th>
                                    <th className="text-left pb-2 text-zinc-500 font-medium pr-4">Cond</th>
                                    <th className="text-center pb-2 text-zinc-500 font-medium pr-4">Qty</th>
                                    <th className="text-right pb-2 text-zinc-500 font-medium pr-4">TCG Market</th>
                                    <th className="text-right pb-2 text-zinc-500 font-medium pr-4">Paid</th>
                                    <th className="text-right pb-2 text-zinc-500 font-medium">Target Sell</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail[p.id].map(item => (
                                    <tr key={item.id} className="border-b border-zinc-800/30 last:border-0">
                                      <td className="py-1.5 pr-4 text-zinc-200">
                                        <CardNameLink name={item.cardName} />{item.foil ? ' ✦' : ''}
                                        <span className="ml-1 text-zinc-600">{item.setCode.toUpperCase()}</span>
                                      </td>
                                      <td className="py-1.5 pr-4 text-zinc-400">{item.condition}</td>
                                      <td className="py-1.5 pr-4 text-center text-zinc-400">{item.quantity}</td>
                                      <td className="py-1.5 pr-4 text-right text-zinc-500 tabular-nums">{fmt(item.tcgMarketCents)}</td>
                                      <td className="py-1.5 pr-4 text-right text-zinc-300 font-medium tabular-nums">{fmt(item.buyPriceCents)}</td>
                                      <td className="py-1.5 text-right text-zinc-500 tabular-nums">
                                        {item.targetSellPriceCents != null ? fmt(item.targetSellPriceCents) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
