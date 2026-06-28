'use client';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-900/40 text-green-400 border-green-800',
  intermediate: 'bg-amber-900/40 text-amber-400 border-amber-800',
  advanced: 'bg-red-900/40 text-red-400 border-red-800',
};

const COLOR_ICONS: Record<string, string> = {
  W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '💠',
};

interface Props {
  id: string;
  label: string;
  description: string;
  colors?: string[];
  difficulty?: string;
  selected?: boolean;
  recommended?: boolean;
  onClick: () => void;
  small?: boolean;
}

export function ThemeTile({ label, description, colors = [], difficulty, selected, recommended, onClick, small }: Props) {
  const diffColor = DIFFICULTY_COLORS[difficulty ?? 'beginner'] ?? DIFFICULTY_COLORS.beginner;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        selected
          ? 'bg-amber-400/10 border-amber-500 text-zinc-100'
          : recommended
            ? 'bg-amber-400/5 border-amber-700/60 text-zinc-300 hover:border-amber-500'
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
      } ${small ? 'p-2' : 'p-3'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {recommended && !selected && <span className="text-amber-500 text-xs">✦</span>}
          <span className={`font-semibold text-sm ${selected ? 'text-amber-400' : recommended ? 'text-amber-200' : 'text-zinc-200'}`}>{label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {colors.slice(0, 4).map(c => <span key={c} className="text-xs">{COLOR_ICONS[c] ?? c}</span>)}
          {difficulty && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${diffColor}`}>
              {difficulty}
            </span>
          )}
        </div>
      </div>
      {!small && <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</p>}
    </button>
  );
}
