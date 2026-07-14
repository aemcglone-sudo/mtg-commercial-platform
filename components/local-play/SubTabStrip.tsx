'use client';

export type LocalPlayTab = 'stores' | 'events' | 'cards';

interface Props {
  active: LocalPlayTab;
  onSelect: (tab: LocalPlayTab) => void;
}

const TABS: { id: LocalPlayTab; label: string; icon: string }[] = [
  { id: 'stores', label: 'Stores', icon: '🏪' },
  { id: 'events', label: 'Events', icon: '🎲' },
  { id: 'cards', label: 'Find Cards', icon: '🃏' },
];

export default function SubTabStrip({ active, onSelect }: Props) {
  return (
    <div className="flex border-b border-zinc-800 px-4">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
            active === tab.id
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
