'use client';
import { useState } from 'react';
import CardDetailModal from '@/components/CardDetailModal';

interface Props {
  name: string;
  imageUrl?: string | null;
  className?: string;
}

export function CardNameLink({ name, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className={`cursor-pointer hover:text-white underline decoration-dotted underline-offset-2 decoration-zinc-600 ${className ?? ''}`}
      >
        {name}
      </span>
      {open && (
        <CardDetailModal
          cardName={name}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
