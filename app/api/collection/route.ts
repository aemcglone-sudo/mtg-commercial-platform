import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthenticatedUserId } from '@/lib/auth';
import { parseCollectionWithGemini } from '@/lib/parse-with-gemini';
import { parseCollection } from '@/lib/parse-collection';
import { getCards, cardPrice, cardImageUrl } from '@/lib/scryfall';
import { findOne, run } from '@/lib/db';

export const maxDuration = 540; // 9 minutes - near Vercel limit

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  const body = await req.json();
  const text: string = body.text ?? '';
  const collectionType: 'paper' | 'arena' = body.collectionType ?? 'paper';
  const mergeMode: 'replace' | 'add' = body.mergeMode ?? 'replace';
  console.log(`Collection upload: mergeMode='${mergeMode}', collectionType='${collectionType}'`);

  if (!text.trim()) return NextResponse.json({ error: 'Empty collection' }, { status: 400 });

  let collection: Map<string, number>;
  let detectedFormat: string;

  // Try fast CSV parser first
  collection = parseCollection(text);
  if (collection.size > 0) {
    detectedFormat = 'CSV';
    console.log(`Fast CSV parser recognized ${collection.size} cards`);
  } else {
    // Fall back to Gemini for complex formats
    console.log('Fast parser found 0 cards, trying Gemini for complex formats...');
    try {
      ({ collection, detectedFormat } = await parseCollectionWithGemini(text));
      console.log(`Gemini parsed collection as ${detectedFormat}`);
    } catch (err) {
      console.error('Gemini parsing failed:', err);
      return NextResponse.json(
        { error: 'Failed to parse collection. Supported formats: CSV, plain text (4 Card Name), JSON, and more.' },
        { status: 422 }
      );
    }
  }

  if (collection.size === 0) {
    return NextResponse.json({ error: 'Could not parse any cards from the file' }, { status: 422 });
  }


  console.log(`Parsed ${collection.size} unique cards from collection`);
  const cardData = await getCards([...collection.keys()]);
  console.log(`Scryfall returned data for ${cardData.size} cards`);

  const notFoundNames = [...collection.keys()].filter(name => !cardData.has(name));
  if (notFoundNames.length > 0) {
    console.log(`${notFoundNames.length} cards not found in Scryfall batch lookup — kept with null metadata: ${notFoundNames.slice(0, 10).join(', ')}${notFoundNames.length > 10 ? '…' : ''}`);
  }

  const collectionCards = [...collection.entries()]
    .map(([name, quantity]) => {
      const card = cardData.get(name);
      const colors = card?.colors ?? card?.card_faces?.[0]?.colors ?? [];
      return {
        name,
        quantity,
        priceUsd: card ? cardPrice(card) : null,
        imageUrl: card ? cardImageUrl(card, 'normal') : null,
        scryfallUri: card?.scryfall_uri ?? null,
        setName: card?.set_name ?? null,
        typeLine: card?.type_line ?? null,
        colors,
        cmc: card?.cmc ?? null,
        rarity: card?.rarity ?? null,
        oracleText: card?.oracle_text ?? null,
        artist: card?.artist ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const result = {
    collectionSize: collection.size,
    totalCards: [...collection.values()].reduce((a, b) => a + b, 0),
    detectedFormat,
    collectionCards,
    cardNames: collectionCards.map(c => c.name),
  };

  // Persist to DB when authenticated
  if (userId) {
    const parsedData = JSON.stringify(result);

    try {
      // Always create a new record for each upload (keeps history for metadata)
      await run(
        `INSERT INTO collection_uploads (id, "userId", "rawText", "detectedFormat", "parsedData", "createdAt")
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [randomUUID(), userId, text, detectedFormat, parsedData]
      );
    } catch (err) {
      console.error('Failed to save collection upload:', err);
      return NextResponse.json({ error: 'Failed to save collection' }, { status: 500 });
    }

    // Store individual cards in inventory_items with collectionType (best effort, doesn't block)
    try {
      if (mergeMode === 'replace') {
        // Clear existing cards of this type for replace mode
        await run(
          `DELETE FROM inventory_items WHERE "userId" = ? AND "itemType" = 'cards' AND "collectionType" = ?`,
          [userId, collectionType]
        );
        console.log(`Replaced cards: deleted existing ${collectionType} cards for user`);

        // Batch insert cards (100 at a time for efficiency with large collections)
        const batchSize = 100;
        for (let i = 0; i < collectionCards.length; i += batchSize) {
          const batch = collectionCards.slice(i, i + batchSize);
          const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, NOW(), NOW())').join(',');
          const values = batch.flatMap(card => [
            crypto.randomUUID(), userId, card.name, 'cards', collectionType, card.quantity
          ]);

          await run(
            `INSERT INTO inventory_items (id, "userId", name, "itemType", "collectionType", quantity, "createdAt", "updatedAt")
             VALUES ${placeholders}`,
            values
          );
        }
      } else {
        // For add mode, merge with existing quantities
        for (const card of collectionCards) {
          // Check if card exists
          const existing = await findOne(
            `SELECT id, quantity FROM inventory_items WHERE "userId" = ? AND name = ? AND "itemType" = 'cards' AND "collectionType" = ?`,
            [userId, card.name, collectionType]
          );

          if (existing) {
            // Update quantity
            await run(
              `UPDATE inventory_items SET quantity = quantity + ?, "updatedAt" = NOW() WHERE id = ?`,
              [Number(card.quantity), (existing as any).id]
            );
          } else {
            // Insert new card
            await run(
              `INSERT INTO inventory_items (id, "userId", name, "itemType", "collectionType", quantity, "createdAt", "updatedAt")
               VALUES (?, ?, ?, 'cards', ?, ?, NOW(), NOW())`,
              [randomUUID(), userId, card.name, collectionType, Number(card.quantity)]
            );
          }
        }
        console.log(`Add mode: merged ${collectionCards.length} cards for user with collectionType=${collectionType}`);
      }
    } catch (err) {
      console.error('Failed to store inventory items:', err);
      // Fail the upload if inventory items can't be saved - user needs to see this error
      return NextResponse.json(
        { error: 'Failed to save cards to collection. Please try uploading again.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(result);
}
