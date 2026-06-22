import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

// Known name corrections: wrong → canonical Scryfall name
const NAME_FIXES: Record<string, string> = {
  'Massacre Wurm': 'Massacre Worm',
};

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await findOne<{ id: string; parsedData: string; rawText: string }>(
    'SELECT id, "parsedData", "rawText" FROM collection_uploads WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 1',
    [userId]
  );
  if (!row) return NextResponse.json({ error: 'No collection found' }, { status: 404 });

  const data = JSON.parse(row.parsedData);
  const fixes: string[] = [];

  data.collectionCards = data.collectionCards.map((card: { name: string }) => {
    const corrected = NAME_FIXES[card.name];
    if (corrected) {
      fixes.push(`${card.name} → ${corrected}`);
      return { ...card, name: corrected };
    }
    return card;
  });

  await run(
    'UPDATE collection_uploads SET parsedData = ? WHERE id = ?',
    [JSON.stringify(data), row.id]
  );

  return NextResponse.json({ fixed: fixes });
}
