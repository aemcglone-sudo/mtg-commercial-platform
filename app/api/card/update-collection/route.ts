import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { run } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, collectionType } = body;

  if (!name || !collectionType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    await run(
      `UPDATE inventory_items SET collectionType = ?, updatedAt = datetime('now')
       WHERE userId = ? AND name = ? AND itemType = 'cards'`,
      [collectionType, session.user.id, name]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update card:', err);
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
  }
}
