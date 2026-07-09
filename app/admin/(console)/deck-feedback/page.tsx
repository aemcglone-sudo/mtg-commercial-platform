'use client';

import { useState } from 'react';
import type { SuggestedRule } from '@/app/api/admin/deck-feedback/route';

const FORMATS = ['commander', 'standard', 'pioneer', 'modern', 'legacy', 'pauper', 'limited', 'brawl'];

const SCOPE_COLORS: Record<string, string> = {
  all: 'bg-zinc-700 text-zinc-300',
  commander: 'bg-amber-900/60 text-amber-300',
  standard: 'bg-blue-900/60 text-blue-300',
  pioneer: 'bg-purple-900/60 text-purple-300',
  modern: 'bg-green-900/60 text-green-300',
  legacy: 'bg-red-900/60 text-red-300',
  limited: 'bg-cyan-900/60 text-cyan-300',
  brawl: 'bg-pink-900/60 text-pink-300',
  collection_only: 'bg-emerald-900/60 text-emerald-300',
};

interface ReviewRule extends SuggestedRule {
  approved: boolean;
}

type Phase = 'input' | 'review' | 'committed';

export default function DeckFeedbackPage() {
  const [format, setFormat] = useState('commander');
  const [deckList, setDeckList] = useState('');
  const [feedback, setFeedback] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState('');
  const [rules, setRules] = useState<ReviewRule[]>([]);
  const [committedCount, setCommittedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!feedback.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/deck-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deckList: deckList.trim() || undefined, feedback, format }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { summary: string; rules: SuggestedRule[] };
      setSummary(data.summary);
      setRules(data.rules.map(r => ({ ...r, approved: true })));
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
    setLoading(false);
  }

  async function handleCommit() {
    const approved = rules.filter(r => r.approved);
    if (!approved.length) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/deck-feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rules: approved }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { committed: number };
      setCommittedCount(data.committed);
      setPhase('committed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Commit failed');
    }
    setCommitting(false);
  }

  function handleReset() {
    setPhase('input');
    setFeedback('');
    setDeckList('');
    setSummary('');
    setRules([]);
    setError(null);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Deck Feedback</h1>
        <p className="text-zinc-500 mt-1 text-sm">Paste a deck list and describe what went wrong. Khoa will derive rules and add them to the corpus.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {phase === 'input' && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Format</label>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                    format === f
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              Deck List <span className="text-zinc-600 font-normal normal-case">(optional — paste the full deck)</span>
            </label>
            <textarea
              value={deckList}
              onChange={e => setDeckList(e.target.value)}
              rows={8}
              placeholder={"1 Yuriko, the Tiger's Shadow\n1 Arcane Signet\n20 Island\n..."}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm font-mono px-4 py-3 resize-none focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              Feedback <span className="text-red-500">*</span>
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={5}
              placeholder="e.g. Built a Yuriko commander deck with no ninjas. The win_conditions role filled with generic spells instead of ninjas. Yuriko needs ninjutsu enablers (cheap unblockable 1-drops) and 15+ ninja creatures to function."
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm px-4 py-3 resize-none focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
            />
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !feedback.trim()}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-900 font-semibold px-6 py-2.5 text-sm transition-colors"
          >
            {loading ? 'Khoa is thinking…' : 'Analyze & Generate Rules →'}
          </button>
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400 text-xs">✦</span>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Khoa's Analysis</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{summary}</p>
          </div>

          {/* Rules to review */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-300">
                Suggested Rules <span className="text-zinc-600 font-normal">({rules.filter(r => r.approved).length} of {rules.length} approved)</span>
              </h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRules(r => r.map(x => ({ ...x, approved: true })))} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Approve all</button>
                <span className="text-zinc-700">·</span>
                <button type="button" onClick={() => setRules(r => r.map(x => ({ ...x, approved: false })))} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Reject all</button>
              </div>
            </div>

            <div className="space-y-3">
              {rules.map((rule, i) => (
                <div
                  key={i}
                  className={`rounded-xl border px-5 py-4 transition-all ${
                    rule.approved
                      ? 'border-zinc-700 bg-zinc-900'
                      : 'border-zinc-800 bg-zinc-900/40 opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setRules(r => r.map((x, j) => j === i ? { ...x, approved: !x.approved } : x))}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        rule.approved ? 'bg-amber-500 border-amber-500' : 'bg-transparent border-zinc-600 hover:border-zinc-400'
                      }`}
                    >
                      {rule.approved && <span className="text-zinc-900 text-xs font-bold">✓</span>}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${SCOPE_COLORS[rule.scope] ?? SCOPE_COLORS.all}`}>
                          {rule.scope}
                        </span>
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5">{rule.category}</span>
                        <span className={`text-[10px] rounded-full px-2 py-0.5 ${rule.enforcement === 'hard' ? 'bg-red-900/50 text-red-300' : 'bg-zinc-800 text-zinc-400'}`}>
                          {rule.enforcement}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-100 leading-snug mb-1">{rule.rule_text}</p>

                      {rule.reasoning && (
                        <p className="text-xs text-zinc-500 mt-1.5 italic">{rule.reasoning}</p>
                      )}
                      {rule.notes && (
                        <p className="text-xs text-zinc-600 mt-1">Note: {rule.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCommit}
              disabled={committing || rules.filter(r => r.approved).length === 0}
              className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-900 font-semibold px-6 py-2.5 text-sm transition-colors"
            >
              {committing ? 'Saving…' : `Commit ${rules.filter(r => r.approved).length} Rule${rules.filter(r => r.approved).length !== 1 ? 's' : ''} →`}
            </button>
            <button type="button" onClick={handleReset} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              ← Start over
            </button>
          </div>
        </div>
      )}

      {phase === 'committed' && (
        <div className="rounded-xl border border-green-800/50 bg-green-900/10 px-6 py-8 text-center">
          <div className="text-2xl mb-3">✓</div>
          <p className="text-green-400 font-semibold mb-1">{committedCount} rule{committedCount !== 1 ? 's' : ''} added to the corpus</p>
          <p className="text-zinc-500 text-sm mb-6">Every future deck built by Khoa will follow these rules.</p>
          <button type="button" onClick={handleReset} className="rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-5 py-2 text-sm transition-colors">
            Submit more feedback
          </button>
        </div>
      )}
    </div>
  );
}
