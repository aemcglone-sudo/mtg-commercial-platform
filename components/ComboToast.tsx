'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Combo } from '@/lib/combo-finder';

interface ComboToastProps {
  newCombos: Combo[];
  onDismiss: () => void;
}

export default function ComboToast({ newCombos, onDismiss }: ComboToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 10000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  function dismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 max-w-sm w-full transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="bg-zinc-900 border border-amber-700/50 rounded-2xl shadow-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <div>
              <p className="text-sm font-semibold text-amber-400">
                {newCombos.length === 1 ? 'New combo detected!' : `${newCombos.length} new combos detected!`}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">Just added to your collection</p>
            </div>
          </div>
          <button type="button" onClick={dismiss} className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ul className="space-y-1.5">
          {newCombos.slice(0, 3).map((combo, i) => (
            <li key={i} className="text-xs text-zinc-300">
              <span className="text-amber-400 font-medium">{combo.cards.join(' + ')}</span>
              <span className="text-zinc-500"> — {combo.result}</span>
            </li>
          ))}
          {newCombos.length > 3 && (
            <li className="text-xs text-zinc-600">+ {newCombos.length - 3} more…</li>
          )}
        </ul>

        <Link
          href="/?tab=chat"
          onClick={dismiss}
          className="block w-full text-center px-3 py-2 rounded-xl text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors"
        >
          Ask Khoa about these combos →
        </Link>
      </div>
    </div>
  );
}
