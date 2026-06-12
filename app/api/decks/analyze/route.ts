import { NextRequest, NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { db } from '@/lib/db';

interface DeckCard {
  name: string;
  quantity: number;
}

interface Recommendation {
  card: string;
  reason: string;
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
    const { deckId } = await req.json();

    if (!deckId) {
      return NextResponse.json(
        { error: 'deckId is required' },
        { status: 400 }
      );
    }

    // Get deck details
    const deckResult = await db.execute({
      sql: 'SELECT * FROM decks WHERE id = ?',
      args: [deckId],
    });

    const deck = deckResult.rows[0] as any;
    if (!deck) {
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      );
    }

    // Get user's collection
    const collectionResult = await db.execute({
      sql: 'SELECT * FROM collection',
    });
    const collection = collectionResult.rows as any[];
    const collectionMap = new Map(collection.map(c => [c.name, c]));

    const deckCards: DeckCard[] = Object.entries(deck.cards || {}).map(([name, qty]: [string, any]) => ({
      name,
      quantity: qty,
    }));

    // Format deck info for Claude
    const deckInfo = `
Deck: ${deck.name}
Format: ${deck.format}
${deck.commander ? `Commander: ${deck.commander}` : ''}
Strategy: ${deck.strategy || 'Not specified'}

Cards in deck (${deckCards.length} unique):
${deckCards.map(c => `- ${c.quantity}x ${c.name}`).join('\n')}

User's collection has ${collection.length} cards including:
${deckCards.filter(c => collectionMap.has(c.name)).map(c => `- ${c.name}`).join('\n') || '- (no deck cards in collection)'}
    `;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: `You are a Magic: The Gathering expert deck analyst. Analyze decks for strengths, weaknesses, and card recommendations.
Format your response as JSON with these fields:
{
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...],
  "recommendations": [
    {
      "card": "Card Name",
      "reason": "Why this card helps",
      "inCollection": true/false,
      "suggestedQuantity": 1-4
    }
  ],
  "summary": "Brief paragraph about the deck"
}

Provide 3-5 strengths, 3-5 weaknesses, and 5-7 recommendations. Consider the format, strategy, and mana curve.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this ${deck.format} deck:\n${deckInfo}`,
        },
      ],
    });

    const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse the JSON response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to parse analysis' },
        { status: 500 }
      );
    }

    const analysis: DeckAnalysis = JSON.parse(jsonMatch[0]);

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
