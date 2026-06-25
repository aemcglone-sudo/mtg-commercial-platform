import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req);
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const user = await findOne<{ role: string }>('SELECT role FROM users WHERE id = ?', [id]);
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (user.role === 'admin') return NextResponse.json({ error: 'Cannot delete admin accounts.' }, { status: 403 });
  if (session.userId === id) return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 403 });

  // Delete user data that doesn't cascade from users table
  await run('DELETE FROM suggestions WHERE "userId" = ?', [id]);
  await run('DELETE FROM price_alerts WHERE "userId" = ?', [id]);
  await run('DELETE FROM collection_uploads WHERE "userId" = ?', [id]);
  await run('DELETE FROM user_location_preferences WHERE "userId" = ?', [id]);
  await run('DELETE FROM deck_items WHERE "deckId" IN (SELECT id FROM decks WHERE "userId" = ?)', [id]);
  await run('DELETE FROM decks WHERE "userId" = ?', [id]);
  await run('DELETE FROM inventory_items WHERE "userId" = ?', [id]);
  // Deleting the user cascades to: shops (→ shop_inventory → shop_orders), user_preferences, khoa_chats
  await run('DELETE FROM users WHERE id = ?', [id]);

  return NextResponse.json({ ok: true });
}
