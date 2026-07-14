'use client';

import { useState } from 'react';
import type { ShopSite } from '@/components/storefront/types';
import GalleryLightbox from './GalleryLightbox';

type Props = {
  gallery: ShopSite['gallery'];
  primaryHex: string;
  isLight: boolean;
};

export default function StorefrontGallery({ gallery, primaryHex, isLight }: Props) {
  const [idx, setIdx] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (gallery.length === 0) return null;

  const prev = () => setIdx(i => (i - 1 + gallery.length) % gallery.length);
  const next = () => setIdx(i => (i + 1) % gallery.length);
  const current = gallery[idx];

  const arrowCls = 'absolute top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/75 text-white rounded-full p-1.5 transition-colors';

  return (
    <section className="px-6 py-6">
      <h2 className="text-lg font-semibold mb-3" style={{ color: primaryHex }}>Photos</h2>

      {/* Carousel */}
      <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black cursor-pointer group"
        onClick={() => setLightboxIndex(idx)}>
        <img
          key={current.id}
          src={current.imageUrl}
          alt={current.caption ?? ''}
          className="w-full h-full object-cover transition-opacity duration-300"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {/* Arrows */}
        {gallery.length > 1 && (
          <>
            <button type="button" title="Previous photo" onClick={e => { e.stopPropagation(); prev(); }}
              className={`${arrowCls} left-2`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
              </svg>
            </button>
            <button type="button" title="Next photo" onClick={e => { e.stopPropagation(); next(); }}
              className={`${arrowCls} right-2`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </>
        )}

        {/* Counter + caption */}
        <div className="absolute bottom-2 inset-x-0 px-3 flex items-end justify-between pointer-events-none">
          {current.caption
            ? <p className="text-white text-xs drop-shadow line-clamp-1">{current.caption}</p>
            : <span />}
          <span className="text-white/70 text-xs tabular-nums">{idx + 1} / {gallery.length}</span>
        </div>
      </div>

      {/* Dot nav */}
      {gallery.length > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          {gallery.map((img, i) => (
            <button key={img.id} type="button" title={`Photo ${i + 1}`} onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5' : 'w-1.5 h-1.5'} ${i === idx ? '' : isLight ? 'bg-zinc-300' : 'bg-zinc-600'}`}
              style={i === idx ? { backgroundColor: primaryHex } : undefined}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox images={gallery} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </section>
  );
}
