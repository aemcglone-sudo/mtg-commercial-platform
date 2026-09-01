'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import GameTable from '@/components/GameTable';
import { TABLE_HANDOFF_KEY, TABLE_STATE_KEY, type TableHandoff } from '@/lib/game-table-types';

export default function TablePage() {
  const [handoff, setHandoff] = useState<TableHandoff | null | 'none'>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TABLE_HANDOFF_KEY);
      setHandoff(raw ? (JSON.parse(raw) as TableHandoff) : 'none');
    } catch {
      setHandoff('none');
    }

    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen().catch(() => {});
    }
  }

  function exitTable() {
    try { localStorage.removeItem(TABLE_STATE_KEY); } catch { /* ignore */ }
    if (window.opener) {
      window.close();
    } else {
      window.location.href = '/simulator';
    }
  }

  if (handoff === null) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  if (handoff === 'none') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">No active game found</p>
          <p className="text-sm text-zinc-500">Start a game from the Commander Simulator first.</p>
          <Link href="/simulator" className="inline-block px-5 py-2.5 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors text-sm">
            Go to Commander Simulator →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-zinc-950">
      <GameTable handoff={handoff} onExit={exitTable} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
    </div>
  );
}
