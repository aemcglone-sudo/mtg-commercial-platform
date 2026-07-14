import { notFound } from 'next/navigation';

interface HoldData {
  holdId: string;
  status: string;
  cardName: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  guestName: string | null;
  shopName: string;
  shopSlug: string;
  requestExpiresAt: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  requested: { label: 'Pending', color: 'text-yellow-400', icon: '⏳' },
  confirmed: { label: 'Confirmed', color: 'text-green-400', icon: '✅' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', icon: '✕' },
  expired:   { label: 'Expired',   color: 'text-zinc-500', icon: '🕐' },
  fulfilled: { label: 'Fulfilled', color: 'text-blue-400', icon: '🎉' },
};

export default async function GuestHoldStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/storefront/hold/${token}`, { cache: 'no-store' });
  if (!res.ok) notFound();

  const hold = await res.json() as HoldData;
  const s = STATUS_LABEL[hold.status] ?? { label: hold.status, color: 'text-zinc-400', icon: '?' };

  const isActive = ['requested', 'confirmed'].includes(hold.status);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-2">{s.icon}</div>
          <h1 className="text-xl font-semibold">Hold {s.label}</h1>
          <p className="text-sm text-zinc-400">{hold.shopName}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Card</span>
            <span className="font-medium text-right">{hold.cardName}{hold.foil ? ' · Foil' : ''}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Condition</span>
            <span>{hold.condition}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Price</span>
            <span className="text-green-400 font-semibold">${(hold.priceCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Status</span>
            <span className={`font-medium ${s.color}`}>{s.label}</span>
          </div>
          {hold.requestExpiresAt && isActive && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Expires</span>
              <span className="text-zinc-400">{new Date(hold.requestExpiresAt).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Requested</span>
            <span className="text-zinc-400">{new Date(hold.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <a
          href={`/store/${hold.shopSlug}`}
          className="block text-center text-sm text-zinc-400 hover:text-zinc-200 underline"
        >
          ← Back to {hold.shopName}
        </a>

        {isActive && (
          <div className="bg-zinc-900 border border-green-900/40 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-zinc-200">Track all your holds →</p>
            <p className="text-xs text-zinc-400">Create a free Grimoire account to manage holds, build decks, and discover cards.</p>
            <a
              href={`/register/collector?claimHolds=true`}
              className="inline-block text-xs font-medium rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-500 transition-colors"
            >
              Create free account
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
