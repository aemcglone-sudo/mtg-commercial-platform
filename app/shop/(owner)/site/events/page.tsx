'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const PRESET_TYPES = ['FNM', 'Prerelease', 'Draft', 'Tournament', 'Commander Night', 'Other'];
const RECURRENCE_OPTIONS = [
  { value: '',         label: 'One-time' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Monthly' },
];

interface ShopEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: string | null;
  startsAt: string;
  endsAt: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
}

const BLANK_FORM = {
  title: '', description: '', eventType: '', customType: '',
  startsAt: '', endsAt: '', recurrenceRule: '',
};

export default function EventsManagerPage() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [events, setEvents] = useState<ShopEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/shop-site/me')
      .then(r => r.ok ? r.json() : null)
      .then((me: { shopId: string } | null) => {
        if (!me?.shopId) { setLoading(false); return; }
        setShopId(me.shopId);
        return fetch(`/api/shop-site/${me.shopId}/events`)
          .then(r => r.ok ? r.json() : { events: [] })
          .then((d: { events: ShopEvent[] }) => { setEvents(d.events ?? []); setLoading(false); });
      })
      .catch(() => setLoading(false));
  }, []);

  function resolvedType(f: typeof form) {
    if (f.eventType === 'Other' && f.customType.trim()) return f.customType.trim();
    return f.eventType || null;
  }

  async function saveEvent() {
    if (!shopId || !form.title || !form.startsAt) return;
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      eventType: resolvedType(form),
      startsAt: form.startsAt,
      endsAt: form.endsAt || null,
      isRecurring: !!form.recurrenceRule,
      recurrenceRule: form.recurrenceRule || null,
    };
    if (editingId) {
      await fetch(`/api/shop-site/${shopId}/events/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/shop-site/${shopId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    const d = await fetch(`/api/shop-site/${shopId}/events`).then(r => r.json()) as { events: ShopEvent[] };
    setEvents(d.events ?? []);
    setForm(BLANK_FORM);
    setShowForm(false);
    setEditingId(null);
    setSaving(false);
  }

  function startEdit(e: ShopEvent) {
    const isCustom = e.eventType && !PRESET_TYPES.includes(e.eventType);
    setForm({
      title: e.title,
      description: e.description ?? '',
      eventType: isCustom ? 'Other' : (e.eventType ?? ''),
      customType: isCustom ? (e.eventType ?? '') : '',
      startsAt: e.startsAt ? e.startsAt.slice(0, 16) : '',
      endsAt: e.endsAt ? e.endsAt.slice(0, 16) : '',
      recurrenceRule: e.recurrenceRule ?? '',
    });
    setEditingId(e.id);
    setShowForm(true);
  }

  function cancelForm() {
    setForm(BLANK_FORM);
    setShowForm(false);
    setEditingId(null);
  }

  async function deleteEvent(id: string) {
    if (!shopId) return;
    await fetch(`/api/shop-site/${shopId}/events/${id}`, { method: 'DELETE' });
    setEvents(ev => ev.filter(e => e.id !== id));
  }

  function recurrenceLabel(rule: string | null) {
    return RECURRENCE_OPTIONS.find(o => o.value === rule)?.label ?? rule ?? 'One-time';
  }

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/shop/site" className="text-xs text-zinc-600 hover:text-zinc-500">← Site Builder</Link>
          <h1 className="text-xl font-bold text-zinc-100 mt-1">Events</h1>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)}
            className="text-sm bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg">
            + Add Event
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-100">{editingId ? 'Edit Event' : 'New Event'}</h2>
          <input type="text" placeholder="Event title *" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none" />
          <textarea placeholder="Description (optional)" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none" />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 block mb-1">Event Type</label>
              <select title="Event type" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value, customType: '' }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none">
                <option value="">— Select type —</option>
                {PRESET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.eventType === 'Other' && (
              <div className="flex-1">
                <label className="text-xs text-zinc-500 block mb-1">Custom Type Name</label>
                <input type="text" placeholder="e.g. Cube Draft" value={form.customType}
                  onChange={e => setForm(f => ({ ...f, customType: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Start *</label>
              <input type="datetime-local" title="Start date and time" value={form.startsAt}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">End (optional)</label>
              <input type="datetime-local" title="End date and time" value={form.endsAt}
                onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Recurrence</label>
            <select title="Recurrence" value={form.recurrenceRule}
              onChange={e => setForm(f => ({ ...f, recurrenceRule: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none">
              {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={cancelForm} className="text-xs text-zinc-500 hover:text-zinc-400 px-3 py-1.5">Cancel</button>
            <button type="button" onClick={saveEvent} disabled={saving || !form.title || !form.startsAt}
              className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Event'}
            </button>
          </div>
        </div>
      )}

      {events.length === 0
        ? <p className="text-zinc-600 text-sm py-6 text-center">No events yet. Add one to show on your storefront.</p>
        : (
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-100">{e.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {e.eventType && <p className="text-xs text-amber-500/80">{e.eventType}</p>}
                    {e.isRecurring && (
                      <span className="text-xs text-zinc-500">· {recurrenceLabel(e.recurrenceRule)}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">{new Date(e.startsAt).toLocaleString()}</p>
                  {e.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{e.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => startEdit(e)} className="text-zinc-500 hover:text-zinc-300 text-xs">Edit</button>
                  <button type="button" onClick={() => deleteEvent(e.id)} className="text-zinc-600 hover:text-red-400 text-xs">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
