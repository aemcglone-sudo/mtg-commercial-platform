/**
 * Card name linker
 * Parses markdown text and identifies card names that should be clickable
 */

/**
 * Common MTG card name patterns to detect
 * This is a heuristic - card names usually:
 * - Start with capital letter
 * - Are surrounded by specific punctuation or whitespace
 * - Often appear after "x" (e.g., "1x Lightning Bolt")
 */
export function parseCardNamesInText(text: string): Array<{
  text: string;
  isCard: boolean;
  cardName?: string;
}> {
  const parts: Array<{ text: string; isCard: boolean; cardName?: string }> = [];

  // Pattern: "Nx CardName" (e.g., "4x Lightning Bolt")
  const quantityPattern = /(\d+x\s+)([A-Z][a-zA-Z0-9\s,—\-\.\']+?)(?=\s*[—–\n•·]|\s*$|\s+\(|—|$)/g;

  let lastIndex = 0;
  let match;

  while ((match = quantityPattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        isCard: false,
      });
    }

    const quantity = match[1];
    const cardName = match[2].trim();

    // Add quantity part
    parts.push({
      text: quantity,
      isCard: false,
    });

    // Add card name (clickable)
    parts.push({
      text: cardName,
      isCard: true,
      cardName: cardName,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      isCard: false,
    });
  }

  return parts.length > 0 ? parts : [{ text, isCard: false }];
}

/**
 * Extract all card names mentioned in text
 */
export function extractCardNames(text: string): string[] {
  const pattern = /(\d+x\s+)([A-Z][a-zA-Z0-9\s,—\-\.\']+?)(?=\s*[—–\n•·]|\s*$|\s+\(|—|$)/g;
  const cards: string[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const cardName = match[2].trim();
    if (!cards.includes(cardName)) {
      cards.push(cardName);
    }
  }

  return cards;
}
