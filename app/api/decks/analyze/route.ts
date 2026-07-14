import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';
import { geminiChat, extractJson } from '@/lib/gemini';

interface DeckCard {
  name: string;
  quantity: number;
}

interface ScryfallCard {
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  color_identity: string[];
  colors?: string[];
  legalities?: Record<string, string>;
}

interface Recommendation {
  card: string;
  reason: string;
  cutCard: string;
  cutReason: string;
  inCollection: boolean;
  suggestedQuantity: number;
}

interface DeckAnalysis {
  strengths: string[];
  weaknesses: string[];
  recommendations: Recommendation[];
  summary: string;
}

async function fetchScryfallData(names: string[]): Promise<Map<string, ScryfallCard>> {
  const result = new Map<string, ScryfallCard>();
  const CHUNK = 75;
  for (let i = 0; i < names.length; i += CHUNK) {
    const chunk = names.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Grimoire/1.0' },
        body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
      });
      if (!res.ok) continue;
      const data = await res.json() as { data: ScryfallCard[] };
      for (const card of data.data) {
        result.set(card.name.toLowerCase(), card);
        // Also index by front face for MDFCs
        if (card.name.includes('//')) {
          result.set(card.name.split('//')[0].trim().toLowerCase(), card);
        }
      }
    } catch { /* best effort */ }
    if (i + CHUNK < names.length) await new Promise(r => setTimeout(r, 100));
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deckId } = await req.json();
    if (!deckId) {
      return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
    }

    const deck = await findOne(
      'SELECT id, name, format, strategy, cards FROM decks WHERE id = ? AND "userId" = ?',
      [deckId, userId]
    );
    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const cardsObj: Record<string, number> = (deck as any).cards ? JSON.parse((deck as any).cards) : {};
    const deckCards: DeckCard[] = Object.entries(cardsObj).map(([name, qty]) => ({
      name,
      quantity: qty as number,
    }));

    // Ground analysis in real card data from Scryfall — prevents hallucinated mana costs/types.
    const scryfallData = await fetchScryfallData(deckCards.map(c => c.name));

    // Compute actual stats from verified data
    const totalCards = deckCards.reduce((s, c) => s + c.quantity, 0);
    const colorCounts: Record<string, number> = {};
    const formatLegal: string[] = [];
    const formatIllegal: string[] = [];
    const format = ((deck as any).format ?? '').toLowerCase();

    for (const card of deckCards) {
      const data = scryfallData.get(card.name.toLowerCase());
      if (!data) continue;
      for (const c of data.color_identity) {
        colorCounts[c] = (colorCounts[c] ?? 0) + card.quantity;
      }
      if (format && data.legalities) {
        const legality = data.legalities[format];
        if (legality === 'legal') formatLegal.push(card.name);
        else if (legality === 'not_legal' || legality === 'banned') formatIllegal.push(card.name);
      }
    }

    const colorsPresent = Object.keys(colorCounts);

    // Build a grounded card list for the prompt with verified data
    const cardListWithData = deckCards.map(card => {
      const data = scryfallData.get(card.name.toLowerCase());
      if (data) {
        return `${card.quantity}x ${card.name} | Cost: ${data.mana_cost ?? 'N/A'} | CMC: ${data.cmc} | ${data.type_line}`;
      }
      return `${card.quantity}x ${card.name} | (data unavailable)`;
    }).join('\n');

    // Get user's collection
    const collectionRows = await findMany(
      `SELECT name, quantity FROM inventory_items WHERE "userId" = ? AND "itemType" = 'cards'`,
      [userId]
    );
    const collectionMap = new Map<string, number>(
      collectionRows.map((r: any) => [r.name as string, r.quantity as number])
    );

    const d = deck as any;
    const deckInfo = `
Deck: ${d.name}
Format: ${d.format || 'Unknown'}
Strategy: ${d.strategy || 'Not specified'}
Total cards: ${totalCards} (minimum required: ${totalCards < 60 ? '60 — DECK IS SHORT BY ' + (60 - totalCards) + ' CARDS' : 'met'})
Colors present (from actual card data): ${colorsPresent.length > 0 ? colorsPresent.join('') : 'Colorless'}
${formatIllegal.length > 0 ? `NOT LEGAL IN ${d.format?.toUpperCase()}: ${formatIllegal.join(', ')}` : ''}

Cards (verified mana costs and types from Scryfall):
${cardListWithData}

Cards from this deck in your collection:
${deckCards.filter(c => collectionMap.has(c.name)).map(c => `- ${c.name} (have ${collectionMap.get(c.name)})`).join('\n') || '(none)'}
    `.trim();

    const rulesDoc = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/deck-wizard/rules`,
      { headers: { cookie: req.headers.get('cookie') ?? '' } }
    ).then(r => r.ok ? r.json() as Promise<{ value: string }> : { value: '' })
      .then(d => d.value ?? '')
      .catch(() => '');

    const system = `You are a Magic: The Gathering expert deck analyst. The card data below (mana costs, types, colors) comes directly from Scryfall and is accurate — trust it over your own memory. Every recommendation must include both a card to ADD and a specific card to CUT from the deck. Return only valid JSON, no markdown or prose.

DECK BUILDING REFERENCE:
${rulesDoc ? rulesDoc.slice(0, 3000) : '(use standard MTG deckbuilding conventions)'}`;

    const analyzePrompt = `Analyze this ${d.format || ''} deck and return JSON.

${deckInfo}

CRITICAL RULE: For each recommendation, you must name a specific card to CUT from the deck listed above. Choose the weakest or least synergistic card in the deck for that slot. Base your mana cost and color analysis ONLY on the verified Scryfall data shown above — do not guess or recall card costs from memory.

Return this exact JSON structure:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "recommendations": [
    {
      "card": "Card to Add",
      "reason": "One sentence why this card belongs in the deck",
      "cutCard": "Specific card from the deck list above to remove",
      "cutReason": "One sentence why that card is the weakest in its slot",
      "inCollection": false,
      "suggestedQuantity": 1
    }
  ],
  "summary": "Brief paragraph about the deck"
}

Provide 3-5 strengths, 3-5 weaknesses, and 5-7 swap recommendations. Every recommendation needs both a card to add AND a card to cut from the deck.`;

    const analysisRaw = await geminiChat(analyzePrompt, 0.7, system, 8192);
    if (!analysisRaw) {
      return NextResponse.json({ error: 'AI unavailable' }, { status: 502 });
    }
    const analysis: DeckAnalysis = JSON.parse(extractJson(analysisRaw));

    const finalRecommendations = analysis.recommendations.map(rec => ({
      ...rec,
      inCollection: collectionMap.has(rec.card),
    }));

    return NextResponse.json({
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: finalRecommendations,
      summary: analysis.summary,
      // Surface verified facts the UI can show
      meta: {
        totalCards,
        colorsPresent,
        formatIllegalCards: formatIllegal,
      },
    });
  } catch (error) {
    console.error('Deck analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
