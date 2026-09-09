/** Ticker-style price display: current price on top, absolute $ change and
 * (%) change stacked below it, colored by direction — the layout from
 * familiar stock-ticker UIs (see the "Top losers" mock this was modeled
 * after). Used anywhere we show a price next to how it moved. */
export default function PriceChange({
  price, changeAbs, changePct, align = 'end', size = 'sm',
}: {
  price: number;
  changeAbs: number;
  changePct: number;
  align?: 'start' | 'end';
  size?: 'sm' | 'md';
}) {
  const up = changePct >= 0;
  const priceCls = size === 'md' ? 'text-base font-semibold' : 'text-sm font-semibold';
  return (
    <div className={`flex flex-col ${align === 'end' ? 'items-end' : 'items-start'} shrink-0`}>
      <span className={`${priceCls} text-zinc-100`}>${price.toFixed(2)}</span>
      <span className={`text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        {up ? '+' : ''}{changeAbs.toFixed(2)} ({up ? '+' : ''}{changePct.toFixed(1)}%)
      </span>
    </div>
  );
}
