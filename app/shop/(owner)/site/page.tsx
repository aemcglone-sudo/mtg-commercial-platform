'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import GalleryManager from '@/components/gallery/GalleryManager';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};
const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourshop' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourshop' },
  { key: 'x', label: 'X / Twitter', placeholder: 'https://x.com/yourshop' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/invite' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourshop' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourshop' },
];
const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero Banner', about: 'About', hours_location: 'Hours & Location',
  inventory: 'Singles Search', buylist: 'Buylist', events: 'Events',
  gallery: 'Photo Gallery', social: 'Follow Us', contact: 'Contact',
};
const SECTION_ICONS: Record<string, string> = {
  hero: '🏪', about: '📖', hours_location: '🕐', inventory: '🃏',
  buylist: '📋', events: '🗓', gallery: '🖼', social: '📣', contact: '✉️',
};
const SECTION_DESCRIPTIONS: Record<string, string> = {
  hero: 'Your shop name and banner image shown at the top. Contact info and name come from your Shop Settings.',
  about: 'A paragraph describing your shop, atmosphere, and what makes you unique.',
  hours_location: 'Your address, phone, email, and weekly hours. Edit contact info in Shop Settings.',
  inventory: 'A search box so visitors can find specific singles. Shows price and condition.',
  buylist: 'Coming soon — list cards you\'re actively buying from customers.',
  events: 'Upcoming events like FNM, drafts, and tournaments.',
  gallery: 'Photos of your shop — displayed in a grid on your storefront.',
  social: 'Links to your Instagram, Facebook, Discord, and other social profiles.',
  contact: 'Additional contact section (hidden by default — Hours & Location already shows this).',
};
const REQUIRED_SECTIONS = new Set(['hero', 'hours_location']);
const HAS_EDITOR = new Set(['about', 'hours_location', 'social', 'events', 'gallery', 'branding', 'banner']);

interface Section { id: string; type: string; visible: boolean; sortOrder: number; }

interface SiteApiResponse {
  siteStatus: string;
  slug: string;
  name: string;
  aboutText: string | null;
  hours: Record<string, string>;
  socialLinks: Record<string, string>;
  sections: Section[];
  themePrimaryHex: string;
  themeAccentHex: string;
  themeMode: string;
  template: string;
  bannerUrl: string | null;
}

interface SiteData extends SiteApiResponse {
  shopId: string;
}

export default function SiteBuilderPage() {
  const [data, setData] = useState<SiteData | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState('');

  const [aboutText, setAboutText] = useState('');
  const [aboutSaving, setAboutSaving] = useState(false);

  const [hours, setHours] = useState<Record<string, string>>({});
  const [hoursSaving, setHoursSaving] = useState(false);

  const [social, setSocial] = useState<Record<string, string>>({});
  const [socialSaving, setSocialSaving] = useState(false);

  const [primaryHex, setPrimaryHex] = useState('#7c3aed');
  const [accentHex, setAccentHex] = useState('#f59e0b');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [brandingSaving, setBrandingSaving] = useState(false);

  const [template, setTemplate] = useState<'classic' | 'minimal'>('classic');
  const [templateSaving, setTemplateSaving] = useState(false);

  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/shop-site/me')
      .then(r => r.ok ? r.json() : null)
      .then((me: { shopId: string } | null) => {
        if (!me?.shopId) { setLoading(false); return; }
        setShopId(me.shopId);
        return fetch(`/api/shop-site/${me.shopId}`)
          .then(r => r.ok ? r.json() : null)
          .then((site: SiteApiResponse | null) => {
            if (site) {
              setData({ ...site, shopId: me.shopId });
              setAboutText(site.aboutText ?? '');
              setHours(site.hours ?? {});
              setSocial(site.socialLinks ?? {});
              setPrimaryHex(site.themePrimaryHex ?? '#7c3aed');
              setAccentHex(site.themeAccentHex ?? '#f59e0b');
              setThemeMode((site.themeMode as 'dark' | 'light') ?? 'dark');
              setTemplate((site.template as 'classic' | 'minimal') ?? 'classic');
            }
            setLoading(false);
          });
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggleSection(section: Section) {
    if (REQUIRED_SECTIONS.has(section.type)) return;
    const newVisible = !section.visible;
    setData(d => d ? { ...d, sections: d.sections.map(s => s.id === section.id ? { ...s, visible: newVisible } : s) } : d);
    await fetch(`/api/shop-site/${shopId}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ id: section.id, visible: newVisible }] }),
    });
  }

  function flash(msg: string) { setSaved(msg); setTimeout(() => setSaved(''), 2500); }

  async function saveAbout() {
    setAboutSaving(true);
    await fetch(`/api/shop-site/${shopId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aboutText }) });
    setAboutSaving(false); flash('About saved');
  }

  async function saveHours() {
    setHoursSaving(true);
    await fetch(`/api/shop-site/${shopId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours }) });
    setHoursSaving(false); flash('Hours saved');
  }

  async function saveSocial() {
    setSocialSaving(true);
    await fetch(`/api/shop-site/${shopId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ socialLinks: social }) });
    setSocialSaving(false); flash('Social links saved');
  }

  async function saveTemplate(t: 'classic' | 'minimal') {
    setTemplate(t);
    setTemplateSaving(true);
    await fetch(`/api/shop-site/${shopId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template: t }) });
    setTemplateSaving(false); flash('Template saved');
  }

  async function saveBranding() {
    setBrandingSaving(true);
    await fetch(`/api/shop-site/${shopId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themePrimaryHex: primaryHex, themeAccentHex: accentHex, themeMode }),
    });
    setBrandingSaving(false); flash('Branding saved');
  }

  function applyHoursToAll(value: string) {
    const updated: Record<string, string> = {};
    for (const d of DAYS) updated[d] = value;
    setHours(updated);
  }

  function applyHoursToWeekdays(day: string) {
    const value = hours[day] ?? '';
    const updated = { ...hours };
    for (const d of WEEKDAYS) updated[d] = value;
    setHours(updated);
  }

  async function uploadBanner(file: File) {
    setBannerUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/shop-site/${shopId}/banner`, { method: 'POST', body: form });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setData(d => d ? { ...d, bannerUrl: url } : d);
      flash('Banner uploaded');
    } else {
      flash('Upload failed — try a smaller image');
    }
    setBannerUploading(false);
  }

  async function deleteBanner() {
    const res = await fetch(`/api/shop-site/${shopId}/banner`, { method: 'DELETE' });
    if (res.ok) {
      setData(d => d ? { ...d, bannerUrl: null } : d);
      flash('Banner removed');
    }
  }

  async function togglePublish() {
    if (!data || !shopId) return;
    setPublishing(true);
    const action = data.siteStatus === 'published' ? 'unpublish' : 'publish';
    await fetch(`/api/shop-site/${shopId}/${action}`, { method: 'POST' });
    setData(d => d ? { ...d, siteStatus: action === 'publish' ? 'published' : 'unpublished' } : d);
    setPublishing(false);
  }

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;
  if (!data || !shopId) return <div className="p-8 text-zinc-500 text-sm">Site builder not available.</div>;

  const isPublished = data.siteStatus === 'published';
  const siteUrl = `https://mtg-deck-builder.fly.dev/store/${data.slug}`;
  const previewUrl = `/store/${data.slug}/preview`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Site Builder</h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Your storefront URL:{' '}
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
            {siteUrl}
          </a>
        </p>
      </div>

      {saved && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-2 text-sm text-emerald-300">✅ {saved}</div>
      )}

      {/* Status */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Status: <span className={isPublished ? 'text-emerald-400' : 'text-zinc-500'}>{isPublished ? '● Live' : '○ Draft'}</span>
          </p>
          {isPublished && (
            <p className="text-xs text-zinc-500">
              Live at <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{siteUrl}</a>
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-lg transition-colors">
            Preview ↗
          </a>
          <button type="button" onClick={togglePublish} disabled={publishing}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
              isPublished ? 'bg-red-900/40 hover:bg-red-900/60 text-red-300' : 'bg-emerald-700 hover:bg-emerald-600 text-white'
            }`}>
            {publishing ? '…' : isPublished ? 'Unpublish' : 'Publish Site'}
          </button>
        </div>
      </div>

      {/* Template picker */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Template</h2>
        <div className="grid grid-cols-2 gap-3">
          {([
            {
              id: 'classic' as const,
              label: 'Classic',
              desc: 'Bold hero image, dark or light background, card grid for inventory.',
              preview: (
                <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2 space-y-1 text-[9px] text-zinc-400">
                  <div className="h-5 rounded bg-zinc-700 w-full" />
                  <div className="flex gap-1">
                    <div className="h-8 rounded bg-zinc-700 flex-1" />
                    <div className="h-8 rounded bg-zinc-700 flex-1" />
                    <div className="h-8 rounded bg-zinc-700 flex-1" />
                  </div>
                  <div className="h-3 rounded bg-zinc-700 w-3/4" />
                </div>
              ),
            },
            {
              id: 'minimal' as const,
              label: 'Minimal',
              desc: 'White background, clean typography, price list format for singles.',
              preview: (
                <div className="rounded bg-white p-2 space-y-1 text-[9px] border border-zinc-200">
                  <div className="h-1 rounded bg-violet-500 w-full" />
                  <div className="h-3 rounded bg-zinc-200 w-1/2" />
                  <div className="border-t border-zinc-100 pt-1 space-y-0.5">
                    <div className="flex justify-between"><div className="h-2 rounded bg-zinc-200 w-1/3" /><div className="h-2 rounded bg-zinc-200 w-1/6" /></div>
                    <div className="flex justify-between"><div className="h-2 rounded bg-zinc-200 w-2/5" /><div className="h-2 rounded bg-zinc-200 w-1/6" /></div>
                    <div className="flex justify-between"><div className="h-2 rounded bg-zinc-200 w-1/4" /><div className="h-2 rounded bg-zinc-200 w-1/6" /></div>
                  </div>
                </div>
              ),
            },
          ] as const).map(t => (
            <button key={t.id} type="button" onClick={() => saveTemplate(t.id)} disabled={templateSaving}
              className={`bg-white dark:bg-zinc-900 border-2 rounded-xl p-4 text-left transition-all disabled:opacity-60 ${
                template === t.id ? 'border-amber-500' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}>
              {t.preview}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.label}</span>
                {template === t.id && <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">Active</span>}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Sections grid */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Sections</h2>
        <div className="grid grid-cols-2 gap-2">
          {data.sections.map(section => {
            const required = REQUIRED_SECTIONS.has(section.type);
            const expanded = expandedSection === section.type;
            const hasEditor = HAS_EDITOR.has(section.type);
            const description = SECTION_DESCRIPTIONS[section.type];
            return (
              <div key={section.id} className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden ${expanded ? 'col-span-2' : ''}`}>
                <div className="flex items-start justify-between px-4 py-3 gap-3">
                  <button
                    type="button"
                    onClick={() => hasEditor ? setExpandedSection(expanded ? null : section.type) : undefined}
                    className={`flex-1 text-left ${hasEditor ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{SECTION_ICONS[section.type]}</span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{SECTION_LABELS[section.type] ?? section.type}</span>
                      {required && <span className="text-[10px] text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Required</span>}
                      {hasEditor && <span className="text-zinc-600 text-xs ml-auto mr-2">{expanded ? '▲' : '▼'}</span>}
                    </div>
                    {description && <p className="text-[11px] text-zinc-600 mt-1 ml-7 leading-relaxed">{description}</p>}
                  </button>
                  <button type="button" onClick={() => toggleSection(section)} disabled={required}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors shrink-0 mt-0.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                      section.visible ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-600 dark:text-zinc-300'
                    }`}>
                    {section.visible ? 'Visible' : 'Hidden'}
                  </button>
                </div>

                {/* About editor */}
                {expanded && section.type === 'about' && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-3">
                    <textarea value={aboutText} onChange={e => setAboutText(e.target.value)}
                      placeholder="Tell customers about your shop…" maxLength={2000} rows={5}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 resize-none" />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-600">{aboutText.length}/2000</p>
                      <button type="button" onClick={saveAbout} disabled={aboutSaving}
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                        {aboutSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Hours editor */}
                {expanded && section.type === 'hours_location' && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-4">
                    <p className="text-xs text-zinc-500">
                      Address, phone, and email come from your{' '}
                      <Link href="/shop/settings" className="text-amber-400 hover:underline">Shop Settings</Link>.
                    </p>
                    <div className="space-y-2">
                      {DAYS.map(day => (
                        <div key={day} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-8 shrink-0">{DAY_LABELS[day]}</span>
                          <input type="text" value={hours[day] ?? ''}
                            onChange={e => setHours(h => ({ ...h, [day]: e.target.value }))}
                            placeholder="e.g. 10am – 8pm or Closed"
                            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500" />
                          {WEEKDAYS.includes(day) && hours[day] && (
                            <button type="button" onClick={() => applyHoursToWeekdays(day)}
                              title="Copy to all weekdays"
                              className="text-[10px] text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 shrink-0 px-1">
                              → Weekdays
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {hours[DAYS[0]] && (
                        <button type="button" onClick={() => applyHoursToAll(hours[DAYS[0]] ?? '')}
                          className="text-xs text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 rounded-lg transition-colors">
                          Copy Mon to all days
                        </button>
                      )}
                      <button type="button" onClick={() => setHours(h => { const u = { ...h }; for (const d of ['sat','sun']) u[d] = 'Closed'; return u; })}
                        className="text-xs text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 rounded-lg transition-colors">
                        Set Sat/Sun Closed
                      </button>
                      <div className="ml-auto">
                        <button type="button" onClick={saveHours} disabled={hoursSaving}
                          className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                          {hoursSaving ? 'Saving…' : 'Save Hours'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Events link */}
                {expanded && section.type === 'events' && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-2">
                    <p className="text-sm text-zinc-400">Add and manage upcoming events that appear on your storefront.</p>
                    <Link href="/shop/site/events" className="inline-block text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                      Manage Events →
                    </Link>
                  </div>
                )}

                {/* Gallery editor */}
                {expanded && section.type === 'gallery' && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4">
                    <GalleryManager />
                  </div>
                )}

                {/* Social editor */}
                {expanded && section.type === 'social' && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-3">
                    {SOCIAL_PLATFORMS.map(p => (
                      <div key={p.key} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-20 shrink-0">{p.label}</span>
                        <input type="url" value={social[p.key] ?? ''} onChange={e => setSocial(s => ({ ...s, [p.key]: e.target.value }))}
                          placeholder={p.placeholder}
                          className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500" />
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <button type="button" onClick={saveSocial} disabled={socialSaving}
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                        {socialSaving ? 'Saving…' : 'Save Links'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setExpandedSection(expandedSection === 'branding' ? null : 'branding')}
          className="w-full flex items-start justify-between px-4 py-3 text-left cursor-pointer">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Colors & Theme</span>
              <span className="text-zinc-600 text-xs ml-auto mr-2">{expandedSection === 'branding' ? '▲' : '▼'}</span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-1 ml-7 leading-relaxed">Customize your storefront's primary color, accent color, and light/dark background.</p>
          </div>
        </button>
        {expandedSection === 'branding' && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" title="Primary color picker" value={primaryHex} onChange={e => setPrimaryHex(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border border-zinc-300 dark:border-zinc-700" />
                  <input type="text" title="Primary color hex" placeholder="#7c3aed" value={primaryHex} onChange={e => setPrimaryHex(e.target.value)}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 font-mono" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" title="Accent color picker" value={accentHex} onChange={e => setAccentHex(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border border-zinc-300 dark:border-zinc-700" />
                  <input type="text" title="Accent color hex" placeholder="#f59e0b" value={accentHex} onChange={e => setAccentHex(e.target.value)}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 font-mono" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1.5">Background Style</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setThemeMode('dark')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${themeMode === 'dark' ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-600 dark:text-zinc-300'}`}>
                  🌙 Dark
                </button>
                <button type="button" onClick={() => setThemeMode('light')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${themeMode === 'light' ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-600 dark:text-zinc-300'}`}>
                  ☀️ Light
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div title="Color preview" className="flex-1 h-8 rounded-lg bg-gradient-to-r from-[var(--preview-primary)] to-[var(--preview-accent)]"
                ref={el => { if (el) { el.style.background = `linear-gradient(90deg, ${primaryHex} 0%, ${accentHex} 100%)`; } }} />
              <button type="button" onClick={saveBranding} disabled={brandingSaving}
                className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                {brandingSaving ? 'Saving…' : 'Save Branding'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Banner upload */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setExpandedSection(expandedSection === 'banner' ? null : 'banner')}
          className="w-full flex items-start justify-between px-4 py-3 text-left cursor-pointer">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🖼</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Banner Image</span>
              <span className="text-zinc-600 text-xs ml-auto mr-2">{expandedSection === 'banner' ? '▲' : '▼'}</span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-1 ml-7 leading-relaxed">Upload a banner shown at the top of your storefront. Recommended: 1200 × 400 px (3:1 ratio), JPG or PNG, under 5 MB.</p>
          </div>
        </button>
        {expandedSection === 'banner' && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-3">
            {data.bannerUrl && (
              <img src={data.bannerUrl} alt="Current banner" className="w-full h-32 object-cover rounded-xl" />
            )}
            <input ref={bannerInputRef} type="file" title="Upload banner image" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadBanner(f); }} />
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}
                className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
                {bannerUploading ? 'Uploading…' : data.bannerUrl ? 'Replace Banner' : 'Upload Banner'}
              </button>
              {data.bannerUrl && (
                <button type="button" onClick={deleteBanner}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors">
                  Remove
                </button>
              )}
              <p className="text-xs text-zinc-600">JPG, PNG, or WebP · Max 5 MB · 1200×400 px recommended</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
