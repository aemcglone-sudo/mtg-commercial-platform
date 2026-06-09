import { NextResponse, NextRequest } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

interface Row { parsedData: string; rawText: string; detectedFormat: string | null; createdAt: string }
interface InventoryItem { name: string; quantity: number; collectionType?: string | null }

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json(null);

  // Load all inventory items (source of truth for quantities and types)
  const items = await findMany<InventoryItem>(
    `SELECT name, quantity, collectionType FROM inventory_items WHERE userId = ? AND itemType = 'cards' ORDER BY name`,
    [userId]
  );

  if (!items || items.length === 0) return NextResponse.json(null);

  const paperCount = items.filter(i => (i.collectionType || 'paper') === 'paper').length;
  const arenaCount = items.filter(i => i.collectionType === 'arena').length;
  console.log(`Loaded collection: ${items.length} total items - ${paperCount} paper, ${arenaCount} arena`);

  // Get metadata from all uploads (in reverse order so recent ones take precedence)
  const uploads = await findMany<Row>(
    `SELECT parsedData, rawText, detectedFormat, createdAt
     FROM collection_uploads WHERE userId = ? ORDER BY createdAt DESC`,
    [userId]
  );

  try {
    // Build complete card metadata map from all uploads
    let cardMetadata: Map<string, any> = new Map();
    if (uploads && uploads.length > 0) {
      // Process in reverse order so older uploads fill in gaps
      for (let i = uploads.length - 1; i >= 0; i--) {
        const upload = uploads[i];
        if (upload.parsedData) {
          try {
            const data = JSON.parse(upload.parsedData);
            if (data.collectionCards && Array.isArray(data.collectionCards)) {
              // Add cards that don't already have metadata
              data.collectionCards.forEach((c: any) => {
                if (!cardMetadata.has(c.name)) {
                  cardMetadata.set(c.name, c);
                }
              });
            }
          } catch (err) {
            console.error('Failed to parse upload:', err);
          }
        }
      }
    }
    console.log(`Collection loaded: ${cardMetadata.size} cards with metadata, ${items.length} unique cards in inventory`);

    const latestUpload = uploads?.[0];

    // Merge inventory quantities with card metadata
    const collectionCards = items.map((item) => {
      const metadata = cardMetadata.get(item.name) || {};
      const type = item.collectionType || 'paper';
      return {
        name: item.name,
        quantity: item.quantity,
        collectionType: type,
        priceUsd: metadata.priceUsd ?? null,
        imageUrl: metadata.imageUrl ?? null,
        scryfallUri: metadata.scryfallUri ?? null,
        setName: metadata.setName ?? null,
        typeLine: metadata.typeLine ?? null,
        colors: metadata.colors ?? [],
        cmc: metadata.cmc ?? null,
        rarity: metadata.rarity ?? null,
        oracleText: metadata.oracleText ?? null,
        artist: metadata.artist ?? null,
      };
    });

    const finalArenaCount = collectionCards.filter(c => c.collectionType === 'arena').length;
    console.log(`Returning collection with ${finalArenaCount} arena cards and ${collectionCards.filter(c => c.collectionType === 'paper').length} paper cards`);

    const collectionSize = items.length;
    const totalCards = items.reduce((sum, item) => sum + item.quantity, 0);

    return NextResponse.json({
      collectionSize,
      totalCards,
      detectedFormat: latestUpload?.detectedFormat || 'Unknown',
      collectionCards,
      rawText: latestUpload?.rawText || '',
      savedAt: latestUpload?.createdAt || new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(null);
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { run } = await import('@/lib/db');
  await run(`DELETE FROM collection_uploads WHERE userId = ?`, [userId]);
  await run(`DELETE FROM inventory_items WHERE userId = ? AND itemType = 'cards'`, [userId]);
  return NextResponse.json({ success: true });
}
