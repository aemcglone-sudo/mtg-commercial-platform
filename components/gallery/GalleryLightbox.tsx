'use client';

import { useEffect, useState, useCallback } from 'react';

interface GalleryImage {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  caption: string | null;
}

interface Props {
  images: GalleryImage[];
  startIndex?: number;
  onClose: () => void;
}

export default function GalleryLightbox({ images, startIndex = 0, onClose }: Props) {
  const [current, setCurrent] = useState(startIndex);

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose, prev, next]);

  // Touch/swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const image = images[current];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button type="button" onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm tabular-nums z-10">
        {current + 1} / {images.length}
      </div>

      {/* Image */}
      <div
        className="relative max-w-5xl w-full px-16 flex items-center justify-center"
        onClick={e => e.stopPropagation()}
        onTouchStart={e => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={e => {
          if (touchStart === null) return;
          const dx = e.changedTouches[0].clientX - touchStart;
          if (dx < -50) next();
          else if (dx > 50) prev();
          setTouchStart(null);
        }}
      >
        {/* Previous */}
        {images.length > 1 && (
          <button type="button" onClick={e => { e.stopPropagation(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
              <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
            </svg>
          </button>
        )}

        <img
          key={image.id}
          src={image.imageUrl}
          alt={image.caption ?? ''}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-200"
        />

        {/* Next */}
        {images.length > 1 && (
          <button type="button" onClick={e => { e.stopPropagation(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Caption */}
      {image.caption && (
        <p className="text-white/70 text-sm mt-4 max-w-xl text-center px-4" onClick={e => e.stopPropagation()}>
          {image.caption}
        </p>
      )}

      {/* Dot nav */}
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-5" onClick={e => e.stopPropagation()}>
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setCurrent(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-3' : 'bg-white/30 hover:bg-white/60'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
