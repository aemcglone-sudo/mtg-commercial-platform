'use client';

import { useCallback, useState } from 'react';

interface Props {
  onAnalyze: (text: string) => void;
  loading: boolean;
}

export default function CollectionUploader({ onAnalyze, loading }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    file.text().then((t) => setText(t));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          dragOver ? 'border-amber-400 bg-amber-950/30' : 'border-zinc-700 hover:border-zinc-500'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".txt,.csv,.dek"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="pointer-events-none space-y-2">
          <div className="text-4xl">🃏</div>
          <p className="text-zinc-200 font-medium">
            {fileName ? fileName : 'Drop your collection file here'}
          </p>
          <p className="text-zinc-500 text-sm">
            MTGO or Moxfield .txt format · or paste below
          </p>
        </div>
      </div>

      <textarea
        className="w-full h-40 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500 font-mono"
        placeholder={`4 Lightning Bolt\n4 Counterspell\n20 Island\n...`}
        value={text}
        onChange={(e) => { setText(e.target.value); setFileName(''); }}
      />

      <button
        disabled={!text.trim() || loading}
        onClick={() => onAnalyze(text)}
        className="w-full py-3 rounded-xl font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Analyzing your collection…' : 'Find My Best Decks'}
      </button>

      <p className="text-center text-xs text-zinc-600">
        Export from Moxfield → Collection → Export → MTGO Format
      </p>
    </div>
  );
}
