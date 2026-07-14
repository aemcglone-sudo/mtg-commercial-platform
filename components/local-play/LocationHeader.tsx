'use client';

interface Props {
  city: string;
  state: string;
  radiusMiles: number;
  onChangeLocation: () => void;
}

export default function LocationHeader({ city, state, radiusMiles, onChangeLocation }: Props) {
  const locationLabel = city ? `${city}${state ? `, ${state}` : ''}` : 'Your location';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
      <div className="flex items-center gap-2 text-sm text-zinc-300">
        <span>📍</span>
        <span className="font-medium">{locationLabel}</span>
        <span className="text-zinc-500">·  {radiusMiles} mi</span>
      </div>
      <button
        type="button"
        onClick={onChangeLocation}
        className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
      >
        Change
      </button>
    </div>
  );
}
