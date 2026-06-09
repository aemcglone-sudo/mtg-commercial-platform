import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const deck = await findOne<any>(
      `SELECT * FROM decks WHERE id = ? AND userId = ?`,
      [id, session.user.id]
    );

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...deck,
      cards: JSON.parse(deck.cards || '{}'),
    });
  } catch (err) {
    console.error('Deck fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch deck' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, format, strategy, cards, addCards } = body;

  try {
    // Fetch current deck and verify ownership
    const deck = await findOne<any>(
      `SELECT userId, cards FROM decks WHERE id = ?`,
      [id]
    );

    if (!deck || deck.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates: string[] = [];
    const values: (string | null)[] = [];

    // Handle adding cards to existing deck
    if (addCards !== undefined && Array.isArray(addCards)) {
      const currentCards = JSON.parse(deck.cards || '{}');
      for (const { name: cardName, quantity } of addCards) {
        currentCards[cardName] = (currentCards[cardName] || 0) + quantity;
      }
      updates.push('cards = ?');
      values.push(JSON.stringify(currentCards));
    } else if (cards !== undefined) {
      // Replace cards entirely
      updates.push('cards = ?');
      values.push(JSON.stringify(cards));
    }

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (format !== undefined) {
      updates.push('format = ?');
      values.push(format);
    }
    if (strategy !== undefined) {
      updates.push('strategy = ?');
      values.push(strategy);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await run(
      `UPDATE decks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Deck update error:', err);
    return NextResponse.json({ error: 'Failed to update deck' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify ownership
    const deck = await findOne<any>(
      `SELECT userId FROM decks WHERE id = ?`,
      [id]
    );

    if (!deck || deck.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await run(`DELETE FROM decks WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Deck delete error:', err);
    return NextResponse.json({ error: 'Failed to delete deck' }, { status: 500 });
  }
}
