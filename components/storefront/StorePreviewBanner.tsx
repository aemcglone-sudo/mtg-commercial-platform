import Link from 'next/link';

export default function StorePreviewBanner({ slug }: { slug: string }) {
  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-black text-xs font-semibold px-4 py-2 flex items-center justify-between">
      <span>Preview mode — visitors won't see this until you publish.</span>
      <Link href="/shop/site" className="underline hover:no-underline">Back to Site Builder →</Link>
    </div>
  );
}
