import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function analyzeCollection(cardNames: string[]): Promise<{ buildable: any[]; aspirational: any[] }> {
  const cardList = cardNames.join(', ');

  const message = await groq.messages.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are a Magic: The Gathering expert. Given this list of cards, suggest complete Commander decks the user could build. For each deck, list the cards needed from the user's collection.

Cards: ${cardList}

Return a JSON object with:
{
  "buildable": [{"name": "deck name", "commander": "card name", "cards": ["card1", "card2"]}],
  "aspirational": [{"name": "deck name", "commander": "card name", "missingCards": ["card1", "card2"]}]
}`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { buildable: [], aspirational: [] };
}

export async function parseComplexCollection(text: string): Promise<{ cards: Map<string, number>; format: string }> {
  const message = await groq.messages.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Parse this Magic collection export and return JSON with card names and quantities.

Text: ${text}

Return:
{
  "cards": {"card name": quantity, ...},
  "format": "MTGO|Moxfield|Arena|etc"
}`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { cards: {}, format: 'Unknown' };

  return {
    cards: new Map(Object.entries(parsed.cards || {})),
    format: parsed.format || 'Unknown',
  };
}

export async function chatWithShahrazad(userMessage: string, collectionContext: string): Promise<string> {
  const message = await groq.messages.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are Shahrazad, a Magic: The Gathering expert advisor. The user has these cards: ${collectionContext}

User: ${userMessage}

Provide helpful Magic strategy advice.`,
      },
    ],
  });

  return message.content[0].type === 'text' ? message.content[0].text : 'Unable to generate response.';
}
