'use client';

interface Tab {
  id: string;
  label: string;
  count: number;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function FormatTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            active === tab.id
              ? 'bg-amber-400 text-black'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {tab.label}
          <span
            className={`ml-1.5 text-xs ${
              active === tab.id ? 'text-black/60' : 'text-zinc-600'
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
