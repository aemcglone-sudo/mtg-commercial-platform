export interface DeckSuggestion {
  cards: Record<string, number>;
  source: string;
}

export function parseDeckFromText(text: string): DeckSuggestion | null {
  const lines = text.split('\n');
  const cards: Record<string, number> = {};
  let foundCards = false;

  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    // Remove bullet points, dashes, and other prefix characters
    trimmed = trimmed.replace(/^[•\-\*]\s*/, '').trim();

    // Skip headers and non-card lines
    const lowerTrimmed = trimmed.toLowerCase();

    // Only skip if it looks like a header (all caps or starts with certain keywords at line start)
    const isHeader = lowerTrimmed.startsWith('deck') ||
        lowerTrimmed.startsWith('sideboard') ||
        lowerTrimmed.startsWith('maindeck') ||
        lowerTrimmed.startsWith('you own') ||
        lowerTrimmed.startsWith('cards to') ||
        lowerTrimmed.startsWith('total:') ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('🔄') ||
        trimmed.startsWith('📦') ||
        trimmed.startsWith('✅') ||
        trimmed.startsWith('⚠️') ||
        trimmed.startsWith('→');

    // Skip if doesn't start with digit (after removing bullets)
    const startsWithNumber = trimmed.match(/^\d+/);

    if (isHeader || !startsWithNumber) {
      continue;
    }

    // Match patterns like "4 Lightning Bolt" or "1x Brainstorm" or "6x Sol Ring — $1.09"
    const match = trimmed.match(/^(\d+)x?\s+(.+)$/);
    if (match) {
      const qty = parseInt(match[1], 10);
      let cardName = match[2].trim();

      // Remove price info: "Sol Ring — $1.09" -> "Sol Ring"
      if (cardName.includes(' — ')) {
        cardName = cardName.split(' — ')[0].trim();
      }

      // Remove parenthetical notes: "Card (no price listed)" -> "Card"
      if (cardName.includes('(')) {
        cardName = cardName.split('(')[0].trim();
      }

      // Remove bracket annotations: "Card [OWNED]", "Card [NEW]" -> "Card"
      if (cardName.includes('[')) {
        cardName = cardName.split('[')[0].trim();
      }

      // Skip invalid entries
      if (cardName && !/^\d+$/.test(cardName) && cardName.length > 1 && !cardName.includes(':')) {
        cards[cardName] = (cards[cardName] || 0) + qty;
        foundCards = true;
      }
    }
  }

  if (!foundCards || Object.keys(cards).length === 0) {
    return null;
  }

  return { cards, source: text };
}
