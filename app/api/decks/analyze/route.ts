import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';
import { isDemoMode, chatWithClaude } from '@/lib/demo-llm';

interface DeckCard {
  name: string;
  quantity: number;
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

    // cards column is stored as JSON string
    const cardsJson = (deck as any).cards;
    const cardsObj: Record<string, number> = cardsJson ? JSON.parse(cardsJson) : {};
    const deckCards: DeckCard[] = Object.entries(cardsObj).map(([name, qty]) => ({
      name,
      quantity: qty as number,
    }));

    // Get user's collection from inventory_items
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

Cards in deck (${deckCards.length} unique):
${deckCards.map(c => `- ${c.quantity}x ${c.name}`).join('\n')}

Cards from this deck in your collection:
${deckCards.filter(c => collectionMap.has(c.name)).map(c => `- ${c.name} (have ${collectionMap.get(c.name)})`).join('\n') || '(none)'}
    `.trim();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    const rulesDoc = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/deck-wizard/rules`,
      { headers: { cookie: req.headers.get('cookie') ?? '' } }
    ).then(r => r.ok ? r.json() as Promise<{ value: string }> : { value: '' })
      .then(d => d.value ?? '')
      .catch(() => '');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: `You are a Magic: The Gathering expert deck analyst. Every recommendation must include both a card to ADD and a specific card to CUT from the deck. Commander is exactly 100 cards — adding a card always means cutting a card. Return only valid JSON, no markdown or prose.

DECK BUILDING REFERENCE:
${rulesDoc ? rulesDoc.slice(0, 3000) : '(use standard MTG deckbuilding conventions)'}` }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: `Analyze this ${d.format || ''} deck and return JSON.

${deckInfo}

CRITICAL RULE: For each recommendation, you must name a specific card to CUT from the deck listed above. Choose the weakest or least synergistic card in the deck for that slot.

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

Provide 3-5 strengths, 3-5 weaknesses, and 5-7 swap recommendations. Every recommendation needs both a card to add AND a card to cut from the deck.` }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  card: { type: 'string' },
                  reason: { type: 'string' },
                  cutCard: { type: 'string' },
                  cutReason: { type: 'string' },
                  inCollection: { type: 'boolean' },
                  suggestedQuantity: { type: 'integer' },
                },
                required: ['card', 'reason', 'cutCard', 'cutReason', 'inCollection', 'suggestedQuantity'],
              },
            },
            summary: { type: 'string' },
          },
          required: ['strengths', 'weaknesses', 'recommendations', 'summary'],
        },
        maxOutputTokens: 8192,
      },
    });
    let analysisText: string;
    if (isDemoMode()) {
      const systemPrompt = JSON.parse(geminiBody).systemInstruction.parts[0].text as string;
      const userPrompt = JSON.parse(geminiBody).contents[0].parts[0].text as string;
      analysisText = await chatWithClaude(userPrompt, { system: systemPrompt, maxTokens: 4096 }) ?? '';
    } else {
      const geminiOpts = { method: 'POST' as const, headers: { 'Content-Type': 'application/json' }, body: geminiBody };
      const response = await fetch(geminiUrl, geminiOpts);
      if (!response.ok) {
        const errBody = await response.text();
        console.error('Gemini API error:', errBody);
        return NextResponse.json({ error: `AI service error: ${response.status}` }, { status: 502 });
      }
      const data = await response.json();
      analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
    if (!analysisText) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });
    }

    const analysis: DeckAnalysis = JSON.parse(analysisText);

    // Cross-reference recommendations with user's collection
    const finalRecommendations = analysis.recommendations.map(rec => ({
      ...rec,
      inCollection: collectionMap.has(rec.card),
    }));

    return NextResponse.json({
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: finalRecommendations,
      summary: analysis.summary,
    });
  } catch (error) {
    console.error('Deck analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
