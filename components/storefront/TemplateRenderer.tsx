import type { ReactNode } from 'react';
import type { ShopSite } from './types';
import ClassicHero from './templates/classic/ClassicHero';
import ClassicAbout from './templates/classic/ClassicAbout';
import ClassicHoursLocation from './templates/classic/ClassicHoursLocation';
import ClassicInventory from './templates/classic/ClassicInventory';
import ClassicEvents from './templates/classic/ClassicEvents';
import ClassicSocial from './templates/classic/ClassicSocial';
import MinimalHero from './templates/minimal/MinimalHero';
import MinimalAbout from './templates/minimal/MinimalAbout';
import MinimalHoursLocation from './templates/minimal/MinimalHoursLocation';
import MinimalInventory from './templates/minimal/MinimalInventory';
import MinimalEvents from './templates/minimal/MinimalEvents';
import MinimalSocial from './templates/minimal/MinimalSocial';
import StorefrontGallery from '@/components/gallery/StorefrontGallery';

const LIGHT_BG = 'bg-white text-zinc-900';
const DARK_BG  = 'bg-zinc-950 text-zinc-100';

export default function TemplateRenderer({ data }: { data: ShopSite }) {
  const { shop, sections, inventory, events } = data;
  const visible = sections.filter(s => s.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  const isMinimal = shop.template === 'minimal';

  if (isMinimal) {
    return (
      <div className="min-h-screen bg-white text-zinc-900">
        <MinimalHero shop={shop} />
        <div className="w-full">
          {visible.map(section => {
            switch (section.type) {
              case 'hero':           return null;
              case 'about':          return <MinimalAbout key={section.id} shop={shop} />;
              case 'hours_location': return <MinimalHoursLocation key={section.id} shop={shop} />;
              case 'inventory':      return <MinimalInventory key={section.id} inventory={inventory} products={data.products} slug={shop.slug} />;
              case 'events':         return <MinimalEvents key={section.id} events={events} />;
              case 'social':         return <MinimalSocial key={section.id} shop={shop} />;
              case 'gallery':        return <StorefrontGallery key={section.id} gallery={data.gallery} primaryHex={shop.themePrimaryHex} isLight={true} />;
              default:               return null;
            }
          })}
        </div>
      </div>
    );
  }

  // Classic template (default)
  const isLight = shop.themeMode === 'light';
  const cardCls = isLight
    ? 'bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden'
    : 'bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden';

  const visibleTypes = new Set(visible.map(s => s.type));
  const has = (t: string) => visibleTypes.has(t);

  // Fixed layout order:
  //  2-col grid: [about, inventory] [gallery, events] [social]
  //  full-width bottom: hours_location

  type CardDef = { key: string; content: ReactNode };

  const leftCol:  CardDef[] = [];
  const rightCol: CardDef[] = [];

  if (has('about'))     leftCol.push({ key: 'about',     content: <ClassicAbout shop={shop} isLight={isLight} /> });
  if (has('inventory')) rightCol.push({ key: 'inventory', content: <ClassicInventory inventory={inventory} products={data.products} slug={shop.slug} isLight={isLight} shop={shop} /> });
  if (has('gallery'))   leftCol.push({ key: 'gallery',   content: <StorefrontGallery gallery={data.gallery} primaryHex={shop.themePrimaryHex} isLight={isLight} /> });
  if (has('events'))    rightCol.push({ key: 'events',   content: <ClassicEvents events={events} isLight={isLight} shop={shop} /> });
  if (has('social'))    leftCol.push({ key: 'social',    content: <ClassicSocial shop={shop} isLight={isLight} /> });

  const maxRows = Math.max(leftCol.length, rightCol.length);

  return (
    <div className={`min-h-screen ${isLight ? LIGHT_BG : DARK_BG}`}>
      <ClassicHero shop={shop} />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {/* 2-column card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: maxRows }, (_, i) => (
            <div key={i} className="contents">
              {leftCol[i]  ? <div key={leftCol[i].key}  className={cardCls}>{leftCol[i].content}</div>  : <div key={`left-empty-${i}`} />}
              {rightCol[i] ? <div key={rightCol[i].key} className={cardCls}>{rightCol[i].content}</div> : <div key={`right-empty-${i}`} />}
            </div>
          ))}
        </div>

        {/* Hours & Location full-width at bottom */}
        {has('hours_location') && (
          <div className={cardCls}>
            <ClassicHoursLocation shop={shop} isLight={isLight} />
          </div>
        )}
      </div>
    </div>
  );
}
