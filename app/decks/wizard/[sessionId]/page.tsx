'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { WizardShell, WizardState } from '@/components/deck-wizard/WizardShell';

interface SessionData {
  id: string;
  format: string;
  entry_mode: string;
  archetype: string | null;
  themes: string[];
  tribal_type: string | null;
  psychographic: string | null;
  budget_cents: number | null;
  commander_scryfall_id: string | null;
  partner_scryfall_id: string | null;
  natural_language_prompt: string | null;
  current_step: number;
  wizard_state: {
    commanderName?: string;
    commanderColorIdentity?: string[];
    cards?: Record<string, number>;
    roleTargets?: Record<string, number>;
  };
}

export default function WizardSessionPage() {
  const { sessionId } = useParams() as { sessionId: string };
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/deck-wizard/session/${sessionId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { session: SessionData }) => setSession(data.session))
      .catch(() => setError('Session not found or expired.'));
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <div className="text-lg mb-2">{error}</div>
          <a href="/decks/wizard" className="text-amber-400 hover:text-amber-300 text-sm">
            Start a new deck →
          </a>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-600 text-sm">
        Loading session…
      </div>
    );
  }

  const initialState: Partial<WizardState> = {
    format: session.format,
    archetype: session.archetype,
    themes: session.themes ?? [],
    tribalType: session.tribal_type,
    psychographic: session.psychographic,
    budgetCents: session.budget_cents,
    commanderScryfallId: session.commander_scryfall_id,
    partnerScryfallId: session.partner_scryfall_id,
    commanderName: session.wizard_state?.commanderName ?? null,
    commanderColorIdentity: session.wizard_state?.commanderColorIdentity ?? [],
    cards: session.wizard_state?.cards ?? {},
    roleTargets: session.wizard_state?.roleTargets ?? null,
    currentStep: session.current_step ?? 1,
    entryMode: (session.entry_mode as 'guided' | 'natural_language') ?? 'guided',
    sessionId: session.id,
  };

  return <WizardShell sessionId={session.id} initialState={initialState} />;
}
