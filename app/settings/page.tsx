'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SavedInfo {
  collectionSize: number;
  totalCards: number;
  detectedFormat: string;
  savedAt: string;
}

export default function SettingsPage() {
  const router = useRouter();

  const [saved, setSaved] = useState<SavedInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [collectionType, setCollectionType] = useState<'paper' | 'arena'>('paper');
  const [mergeMode, setMergeMode] = useState<'replace' | 'add'>('replace');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetch('/api/collection/saved')
      .then((r) => r.json())
      .then((d) => { if (d) setSaved(d); })
      .finally(() => setLoadingInfo(false));
  }, []);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    file.text().then(setText);
    setUploadSuccess('');
    setUploadError('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  async function handleUpload() {
    if (!text.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    setUploadSuccess('');

    // Simulate progress with realistic timing (spread over ~60 seconds to reach 99%)
    let elapsedTime = 0;
    const progressInterval = setInterval(() => {
      elapsedTime += 500;
      setUploadProgress(prev => {
        // Logarithmic progression: slow at start, faster in middle, slowing near 99%
        const timeBasedProgress = Math.min(99, (Math.log(elapsedTime / 100 + 1) / Math.log(8)) * 99);
        // Add small random variance for natural feel
        const variance = (Math.random() - 0.5) * 2;
        return Math.max(prev, Math.min(timeBasedProgress + variance, 99));
      });
    }, 500);

    try {
      const res = await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, collectionType, mergeMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      setUploadProgress(100);
      setSaved({
        collectionSize: data.collectionSize,
        totalCards: data.totalCards,
        detectedFormat: data.detectedFormat,
        savedAt: new Date().toISOString(),
      });
      setUploadSuccess(`Saved! ${data.collectionSize.toLocaleString()} unique cards detected (${collectionType}).`);
      setText('');
      setFileName('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleClear() {
    if (!confirm('Remove your saved collection? You can re-upload at any time.')) return;
    setClearing(true);
    await fetch('/api/collection/saved', { method: 'DELETE' });
    setSaved(null);
    setClearing(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              ← Back
            </Link>
            <h1 className="text-lg font-bold">Settings</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">

        {/* Collection section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">My Collection</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Upload your Magic collection export. We detect the format automatically.
            </p>
          </div>

          {/* Current saved collection */}
          {!loadingInfo && saved && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-zinc-200">
                  {saved.collectionSize.toLocaleString()} unique cards · {saved.totalCards.toLocaleString()} total
                </p>
                <p className="text-xs text-zinc-500">
                  {saved.detectedFormat && saved.detectedFormat !== 'Unknown'
                    ? `${saved.detectedFormat} · `
                    : ''}
                  Saved {new Date(saved.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href="/"
                  className="px-3 py-1.5 text-xs rounded-lg bg-amber-400 text-black font-medium hover:bg-amber-300 transition-colors"
                >
                  View collection
                </Link>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={clearing}
                  className="px-3 py-1.5 text-xs rounded-lg text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors"
                >
                  {clearing ? 'Clearing…' : 'Clear'}
                </button>
              </div>
            </div>
          )}

          {/* Upload form */}
          <div className="space-y-3">
            {/* Collection type selector */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <label className="block text-sm text-zinc-400 mb-3">Collection Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="collectionType"
                    value="paper"
                    checked={collectionType === 'paper'}
                    onChange={(e) => setCollectionType(e.target.value as 'paper' | 'arena')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-zinc-200">📄 Paper (physical cards)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="collectionType"
                    value="arena"
                    checked={collectionType === 'arena'}
                    onChange={(e) => setCollectionType(e.target.value as 'paper' | 'arena')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-zinc-200">⚡ Arena (online collection)</span>
                </label>
              </div>
            </div>

            {/* Merge mode selector */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <label className="block text-sm text-zinc-400 mb-3">When uploading:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mergeMode"
                    value="replace"
                    checked={mergeMode === 'replace'}
                    onChange={(e) => setMergeMode(e.target.value as 'replace' | 'add')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-zinc-200">🔄 Replace collection</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mergeMode"
                    value="add"
                    checked={mergeMode === 'add'}
                    onChange={(e) => setMergeMode(e.target.value as 'replace' | 'add')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-zinc-200">➕ Add to collection</span>
                </label>
              </div>
            </div>

            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver ? 'border-amber-400 bg-amber-950/20' : 'border-zinc-700 hover:border-zinc-600'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".txt,.csv,.dek"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Upload collection file"
              />
              <div className="pointer-events-none space-y-1">
                <p className="text-zinc-300 font-medium text-sm">
                  {fileName || 'Drop your collection file here'}
                </p>
                <p className="text-zinc-600 text-xs">
                  MTGO, Moxfield, ManaBox, Deckbox, or TCGPlayer · or paste below
                </p>
              </div>
            </div>

            <textarea
              className="w-full h-28 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500 font-mono"
              placeholder={`4 Lightning Bolt\n4 Counterspell\n20 Island`}
              value={text}
              onChange={(e) => { setText(e.target.value); setFileName(''); setUploadSuccess(''); setUploadError(''); }}
            />

            {uploadError   && <p className="text-red-400 text-sm">{uploadError}</p>}
            {uploadSuccess && <p className="text-emerald-400 text-sm">{uploadSuccess}</p>}

            {uploading && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-zinc-500">Analyzing format & saving collection…</p>
                    <p className="text-xs font-medium text-amber-400">{Math.min(Math.round(uploadProgress), 100)}%</p>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!text.trim() || uploading}
              onClick={handleUpload}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {uploading
                ? 'Processing…'
                : mergeMode === 'replace' ? '🔄 Replace collection' : '➕ Add to collection'}
            </button>

            <p className="text-center text-xs text-zinc-600">
              Export from Moxfield → Collection → Export → MTGO Format
            </p>
          </div>
        </section>

        {/* Account section (placeholder for future) */}
        <section className="space-y-4 border-t border-zinc-800 pt-8">
          <h2 className="text-base font-semibold">Account</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Username</span>
              <span className="text-zinc-200">{session?.user?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Email</span>
              <span className="text-zinc-200">{session?.user?.email}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-600">Password change and Google/Apple login coming soon.</p>
        </section>
      </div>
    </div>
  );
}
