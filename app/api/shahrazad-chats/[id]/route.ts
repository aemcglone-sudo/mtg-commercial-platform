import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const chat = await findOne<any>(
      `SELECT * FROM shahrazad_chats WHERE id = ? AND userId = ?`,
      [id, userId]
    );

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...chat,
      messages: JSON.parse(chat.messages),
    });
  } catch (err) {
    console.error('Failed to fetch chat:', err);
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await run(
      `DELETE FROM shahrazad_chats WHERE id = ? AND userId = ?`,
      [id, userId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete chat:', err);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
