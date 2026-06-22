export interface TCGPlayerCard {
  name: string;
  quantity: number;
}

export function buildTCGPlayerUrl(cards: TCGPlayerCard[]): string {
  const valid = cards.filter(c => c.name?.trim() && c.quantity > 0);
  if (valid.length === 0) return 'https://www.tcgplayer.com/massentry';
  const list = valid.map(c => `${c.quantity} ${c.name}`).join('||');
  return `https://www.tcgplayer.com/massentry?c=${encodeURIComponent(list)}`;
}
