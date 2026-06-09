import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { run } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, quantity } = body;

  if (!name || quantity === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (quantity < 0 || !Number.isInteger(quantity)) {
    return NextResponse.json({ error: 'Quantity must be a non-negative integer' }, { status: 400 });
  }

  try {
    if (quantity === 0) {
      // Delete the card if quantity is 0
      await run(
        `DELETE FROM inventory_items WHERE userId = ? AND name = ? AND itemType = 'cards'`,
        [userId, name]
      );
    } else {
      // Update the quantity
      await run(
        `UPDATE inventory_items SET quantity = ?, updatedAt = datetime('now')
         WHERE userId = ? AND name = ? AND itemType = 'cards'`,
        [quantity, userId, name]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update card quantity:', err);
    return NextResponse.json({ error: 'Failed to update quantity' }, { status: 500 });
  }
}
