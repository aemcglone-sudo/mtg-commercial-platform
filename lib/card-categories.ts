import { randomUUID } from 'crypto';
import { findMany, run } from '@/lib/db';
import { classifyCard, CardCategory } from '@/lib/classify-card';

interface CardMeta {
  name: string;
  typeLine: string | null;
  oracleText: string | null;
  cmc: number | null;
}

// Rules-based classification is deterministic (pure regex over Scryfall
// oracle text), so the DB is just a cache to skip recomputation across
// requests — not a source of truth that needs a batch job to populate.
export async function getCategoriesForCards(cards: CardMeta[]): Promise<Map<string, CardCategory[]>> {
  const names = [...new Set(cards.map((c) => c.name))];
  if (names.length === 0) return new Map();

  const cached = await findMany<{ cardName: string; categories: string[] }>(
    `SELECT "cardName", categories FROM card_categories WHERE "cardName" = ANY(?)`,
    [names]
  );
  const result = new Map<string, CardCategory[]>();
  for (const row of cached) result.set(row.cardName, row.categories as CardCategory[]);

  const missing = cards.filter((c) => !result.has(c.name));
  if (missing.length === 0) return result;

  const toInsert: { name: string; categories: CardCategory[] }[] = [];
  const seen = new Set<string>();
  for (const card of missing) {
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    const categories = classifyCard(card);
    result.set(card.name, categories);
    toInsert.push({ name: card.name, categories });
  }

  await Promise.all(
    toInsert.map((c) =>
      run(
        `INSERT INTO card_categories (id, "cardName", categories, "classificationMethod", "createdAt", "updatedAt")
         VALUES (?, ?, ?, 'rules', NOW(), NOW())
         ON CONFLICT ("cardName") DO UPDATE SET categories = EXCLUDED.categories, "updatedAt" = NOW()`,
        [randomUUID(), c.name, c.categories]
      ).catch((err) => console.error(`Failed to cache categories for ${c.name}:`, err))
    )
  );

  return result;
}
