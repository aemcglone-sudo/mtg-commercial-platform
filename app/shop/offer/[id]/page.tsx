import { notFound } from 'next/navigation';

interface OfferItem {
  scryfallId: string;
  cardName: string;
  setCode: string;
  condition: string;
  foil: boolean;
  qty: number;
  tcgCents: number;
  buyPriceCents: number;
}

interface OfferData {
  id: string;
  items: OfferItem[];
  totalCents: number;
  roundedTotalCents: number;
  shopName: string;
  expiresAt: string;
  createdAt: string;
}

async function getOffer(id: string): Promise<OfferData | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/shops/offers/share/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<OfferData>;
  } catch {
    return null;
  }
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await getOffer(id);
  if (!offer) notFound();

  const expiresAt = new Date(offer.expiresAt);
  const now = new Date();
  const expired = now > expiresAt;
  const hoursLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 3600000));
  const expiringSoon = !expired && hoursLeft < 2;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div>
          <div className="text-2xl font-bold">{offer.shopName}</div>
          <div className="text-sm text-gray-500 mt-1">
            Card Buylist Offer · {new Date(offer.createdAt).toLocaleDateString()}
          </div>
        </div>

        {expired && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            This offer has expired.
          </div>
        )}

        {expiringSoon && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-yellow-700 text-sm">
            ⚠ This offer expires in {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''}.
          </div>
        )}

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Card</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Set</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Cond</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Qty</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Buy Price</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {offer.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {item.cardName}{item.foil ? ' (Foil)' : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.setCode.toUpperCase()}</td>
                  <td className="px-4 py-3 text-gray-600">{item.condition}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.qty}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(item.buyPriceCents)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(item.buyPriceCents * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold">{fmt(offer.roundedTotalCents)}</div>
          <div className="text-sm text-gray-400 mt-1">Total offer</div>
        </div>

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-6">
          Offer valid until {expiresAt.toLocaleString()}. Prices based on TCGPlayer market as of {new Date(offer.createdAt).toLocaleDateString()}.
        </div>
      </div>
    </div>
  );
}
