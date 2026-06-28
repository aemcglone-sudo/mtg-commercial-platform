'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WizardShell } from '@/components/deck-wizard/WizardShell';

interface InProgressSession {
  id: string;
  format: string;
  current_step: number;
}

function DeckWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [inProgress, setInProgress] = useState<InProgressSession | null>(null);
  const [mode, setMode] = useState<'select' | 'wizard'>('select');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const prefill = searchParams.get('prefill') === 'true';
  const prefillFormat = searchParams.get('format') ?? 'commander';

  useEffect(() => {
    fetch('/api/deck-wizard/session?status=in_progress')
      .then(r => r.ok ? r.json() : null)
      .then((data: { sessions: InProgressSession[] } | null) => {
        if (data?.sessions?.[0]) setInProgress(data.sessions[0]);
      })
      .catch(() => {});
  }, []);

  async function startNew(entryMode: 'guided' | 'natural_language') {
    setLoading(true);
    try {
      const res = await fetch('/api/deck-wizard/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_mode: entryMode,
          format: prefillFormat,
          current_step: prefill ? 6 : 1,
        }),
      });
      const data = await res.json() as { id?: string };
      if (data.id) setSessionId(data.id);
      setMode('wizard');
    } catch {
      setLoading(false);
    }
  }

  if (mode === 'wizard') {
    return (
      <WizardShell
        sessionId={sessionId ?? undefined}
        initialState={{ format: prefillFormat, currentStep: prefill ? 6 : 1 }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">✨</div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Deck Wizard</h1>
          <p className="text-zinc-500">Build your perfect deck with AI-powered guidance from Khoa.</p>
        </div>

        {inProgress && (
          <div className="mb-6 rounded-xl border border-amber-700/50 bg-amber-400/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-amber-400 text-sm">Unfinished Deck</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {inProgress.format} · Step {inProgress.current_step} of 7
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/decks/wizard/${inProgress.id}`)}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-4 py-1.5 text-sm transition-colors"
              >
                Resume →
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => startNew('guided')}
            disabled={loading}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800 p-5 text-left transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🧙</span>
              <div className="flex-1">
                <div className="font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">Guided Mode</div>
                <div className="text-sm text-zinc-500 mt-0.5">Step-by-step: format → commander → themes → budget → cards</div>
              </div>
              <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors text-lg">→</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => startNew('natural_language')}
            disabled={loading}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800 p-5 text-left transition-all group disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">💬</span>
              <div className="flex-1">
                <div className="font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">Natural Language</div>
                <div className="text-sm text-zinc-500 mt-0.5">Describe your idea and let Khoa handle the rest</div>
              </div>
              <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors text-lg">→</span>
            </div>
          </button>
        </div>

        {loading && (
          <div className="mt-6 text-center text-sm text-zinc-600">Starting your session…</div>
        )}
      </div>
    </div>
  );
}

export default function DeckWizardPage() {
  return <Suspense><DeckWizardContent /></Suspense>;
}
