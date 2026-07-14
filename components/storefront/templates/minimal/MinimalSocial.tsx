import type { ShopSite } from '@/components/storefront/types';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', twitter: 'X (Twitter)',
  youtube: 'YouTube', tiktok: 'TikTok', twitch: 'Twitch', discord: 'Discord',
};

export default function MinimalSocial({ shop }: { shop: ShopSite['shop'] }) {
  const links = Object.entries(shop.socialLinks).filter(([, url]) => url);
  if (!links.length) return null;

  return (
    <section className="max-w-3xl mx-auto px-6 py-10">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">Follow Us</h2>
      <div className="flex flex-wrap gap-3">
        {links.map(([platform, url]) => (
          <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-full px-4 py-1.5 transition-colors hover:border-zinc-400">
            {PLATFORM_LABELS[platform] ?? platform}
          </a>
        ))}
      </div>
    </section>
  );
}
