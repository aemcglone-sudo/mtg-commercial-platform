'use client';

import { useEffect, useRef, useState } from 'react';
import type { DeckRule } from '@/app/api/admin/deck-rules/route';

const CATEGORIES = ['general', 'color_identity', 'deck_size', 'singleton', 'legality', 'ratios', 'mana_curve', 'power_level'];
const SCOPES = ['all', 'commander', 'standard', 'pioneer', 'modern', 'legacy', 'limited', 'brawl', 'collection_only'];

const SCOPE_COLORS: Record<string, string> = {
  all: 'bg-zinc-700 text-zinc-200',
  commander: 'bg-amber-900/60 text-amber-300',
  standard: 'bg-blue-900/60 text-blue-300',
  pioneer: 'bg-purple-900/60 text-purple-300',
  modern: 'bg-green-900/60 text-green-300',
  legacy: 'bg-red-900/60 text-red-300',
  limited: 'bg-cyan-900/60 text-cyan-300',
  brawl: 'bg-pink-900/60 text-pink-300',
  collection_only: 'bg-emerald-900/60 text-emerald-300',
};

const BLANK: Omit<DeckRule, 'id'> = {
  rule_text: '',
  category: 'general',
  scope: 'all',
  enforcement: 'soft',
  active: true,
  sort_order: 0,
  notes: null,
};

function RuleForm({ initial, onSave, onCancel }: {
  initial: Omit<DeckRule, 'id'>;
  onSave: (form: Omit<DeckRule, 'id'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, []);

  async function submit() {
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div ref={ref} className="bg-zinc-800 border border-amber-500/40 rounded-xl p-4 space-y-3">
      <textarea
        value={form.rule_text}
        onChange={e => setForm(p => ({ ...p, rule_text: e.target.value }))}
        rows={3}
        placeholder="Rule text..."
        autoFocus
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500"
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Scope</label>
          <select title="Scope" value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500">
            {SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Category</label>
          <select title="Category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Enforcement</label>
          <select title="Enforcement" value={form.enforcement} onChange={e => setForm(p => ({ ...p, enforcement: e.target.value as 'hard' | 'soft' }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500">
            <option value="soft">Soft (guideline)</option>
            <option value="hard">Hard (enforced in code)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Sort Order</label>
          <input type="number" value={form.sort_order}
            onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
        </div>
      </div>
      <textarea
        value={form.notes ?? ''}
        onChange={e => setForm(p => ({ ...p, notes: e.target.value || null }))}
        rows={1}
        placeholder="Notes (optional)"
        title="Notes"
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-zinc-500"
      />
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={saving || !form.rule_text.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="text-zinc-400 hover:text-zinc-200 px-3 py-1.5 text-sm transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function DeckRulesPage() {
  const [rules, setRules] = useState<DeckRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/admin/deck-rules')
      .then(r => r.json())
      .then(d => setRules(d.rules ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = scopeFilter === 'all' ? rules : rules.filter(r => r.scope === scopeFilter);

  async function saveNew(form: Omit<DeckRule, 'id'>) {
    const res = await fetch('/api/admin/deck-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const { id } = await res.json() as { id: string };
    setRules(prev => [...prev, { id, ...form }]);
    setEditingId(null);
  }

  async function saveEdit(id: string, form: Omit<DeckRule, 'id'>) {
    await fetch(`/api/admin/deck-rules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...form } : r));
    setEditingId(null);
  }

  async function toggleActive(rule: DeckRule) {
    await fetch(`/api/admin/deck-rules/${rule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !rule.active }) });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return;
    await fetch(`/api/admin/deck-rules/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
    if (editingId === id) setEditingId(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Deck Building Rules</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{rules.length} rules · {rules.filter(r => r.active).length} active</p>
        </div>
        <button type="button" onClick={() => setEditingId(editingId === 'new' ? null : 'new')}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          {editingId === 'new' ? 'Cancel' : '+ Add Rule'}
        </button>
      </div>

      {editingId === 'new' && (
        <div className="mb-6">
          <RuleForm initial={BLANK} onSave={saveNew} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {/* Scope filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        {['all', ...SCOPES].map(s => (
          <button key={s} onClick={() => setScopeFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${scopeFilter === s ? 'bg-amber-500 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-1">
          {filtered.map(rule => (
            <div key={rule.id}>
              <div className={`bg-zinc-900 border rounded-xl px-4 py-3 flex gap-3 items-start transition-opacity ${rule.active ? 'border-zinc-800' : 'border-zinc-800/50 opacity-50'} ${editingId === rule.id ? 'rounded-b-none border-b-0' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SCOPE_COLORS[rule.scope] ?? 'bg-zinc-700 text-zinc-300'}`}>{rule.scope}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{rule.category}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${rule.enforcement === 'hard' ? 'bg-red-900/50 text-red-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {rule.enforcement === 'hard' ? 'HARD' : 'soft'}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 leading-snug">{rule.rule_text}</p>
                  {rule.notes && <p className="text-xs text-zinc-500 mt-1">{rule.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => toggleActive(rule)} title={rule.active ? 'Disable' : 'Enable'}
                    className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-colors ${rule.active ? 'bg-green-900/40 text-green-400 hover:bg-green-900/70' : 'bg-zinc-800 text-zinc-600 hover:bg-zinc-700'}`}>
                    {rule.active ? '●' : '○'}
                  </button>
                  <button
                    onClick={() => setEditingId(editingId === rule.id ? null : rule.id)}
                    className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-colors ${editingId === rule.id ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}>
                    ✎
                  </button>
                  <button type="button" onClick={() => deleteRule(rule.id)} className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-red-900/40 text-zinc-500 hover:text-red-400 text-xs flex items-center justify-center transition-colors">✕</button>
                </div>
              </div>
              {editingId === rule.id && (
                <div className="border border-t-0 border-amber-500/40 border-zinc-800 rounded-b-xl overflow-hidden">
                  <RuleForm
                    initial={{ rule_text: rule.rule_text, category: rule.category, scope: rule.scope, enforcement: rule.enforcement, active: rule.active, sort_order: rule.sort_order, notes: rule.notes }}
                    onSave={form => saveEdit(rule.id, form)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
