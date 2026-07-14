import type { ShopSite } from '@/components/storefront/types';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'x', label: 'X / Twitter' },
  { key: 'discord', label: 'Discord' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
];

export default function ClassicSocial({ shop, isLight }: { shop: ShopSite['shop']; isLight?: boolean }) {
  const links = shop.socialLinks ?? {};
  const active = PLATFORMS.filter(p => links[p.key]);
  if (active.length === 0) return null;

  return (
    <section className="px-6 py-6">
      <div>
        <h2 className="text-lg font-semibold mb-3" style={{ color: shop.themePrimaryHex }}>Follow Us</h2>
        <div className="flex flex-wrap gap-3">
          {active.map(p => (
            <a key={p.key} href={links[p.key]} target="_blank" rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg transition-opacity hover:opacity-80 text-white font-medium"
              style={{ backgroundColor: shop.themePrimaryHex }}>
              {p.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
