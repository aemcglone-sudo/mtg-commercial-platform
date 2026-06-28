import { NextRequest, NextResponse } from 'next/server';
import { findMany } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';

interface CardEntry { name: string; quantity: number; colorIdentity?: string[] }

export async function POST(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cards, format, commanderColorIdentity } = await req.json() as {
    cards: CardEntry[];
    format: string;
    commanderColorIdentity?: string[];
  };

  const violations: Array<{ card: string; reason: string }> = [];

  // Check against ban overrides table
  const cardNames = cards.map(c => c.name);
  if (cardNames.length > 0) {
    const banned = await findMany<{ card_name: string; ban_type: string; notes: string }>(
      `SELECT card_name, ban_type, notes FROM format_ban_overrides WHERE format = ? AND card_name = ANY(?)`,
      [format, cardNames as unknown as string]
    );

    for (const b of banned) {
      const cardEntries = cards.filter(c => c.name === b.card_name);
      if (b.ban_type === 'banned') {
        violations.push({ card: b.card_name, reason: `Banned in ${format}${b.notes ? ` (${b.notes})` : ''}` });
      } else if (b.ban_type === 'restricted') {
        const total = cardEntries.reduce((s, c) => s + c.quantity, 0);
        if (total > 1) {
          violations.push({ card: b.card_name, reason: `Restricted in ${format} — max 1 copy allowed` });
        }
      }
    }
  }

  // Color identity check for Commander formats
  if (commanderColorIdentity && commanderColorIdentity.length > 0) {
    const allowed = new Set(commanderColorIdentity);
    for (const card of cards) {
      if (card.colorIdentity) {
        const illegal = card.colorIdentity.filter(c => !allowed.has(c));
        if (illegal.length > 0) {
          violations.push({ card: card.name, reason: `Color identity violation: ${illegal.join(',')} not in commander's identity` });
        }
      }
    }
  }

  // Singleton check
  const isCommander = ['commander','brawl','oathbreaker','canadian_highlander','tiny_leaders'].includes(format);
  if (isCommander) {
    const BASIC_LANDS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes','Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);
    for (const card of cards) {
      if (!BASIC_LANDS.has(card.name) && card.quantity > 1) {
        violations.push({ card: card.name, reason: `Singleton violation: ${card.quantity} copies (max 1 in ${format})` });
      }
    }
  }

  return NextResponse.json({
    legal: violations.length === 0,
    violations,
    cardCount: cards.reduce((s, c) => s + c.quantity, 0),
  });
}
