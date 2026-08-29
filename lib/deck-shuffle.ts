/** Expand a {name: quantity} deck map into one entry per physical card, optionally excluding one card (e.g. the commander, which starts in the command zone rather than the library). */
export function expandDeckToCards(deckCards: Record<string, number>, exclude?: string): string[] {
  const pool: string[] = [];
  for (const [name, qty] of Object.entries(deckCards)) {
    if (exclude && name.toLowerCase() === exclude.toLowerCase()) continue;
    for (let i = 0; i < qty; i++) pool.push(name);
  }
  return pool;
}

/** Fisher-Yates shuffle — does not mutate the input. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
