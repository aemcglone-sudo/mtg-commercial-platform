import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const chat = await findOne<any>(`SELECT * FROM khoa_chats WHERE id = ? AND "userId" = ?`, [id, userId]);
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  return NextResponse.json({ ...chat, messages: JSON.parse(chat.messages) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { title?: string; pinned?: boolean };
  const now = new Date().toISOString();

  if (body.title !== undefined && body.pinned !== undefined) {
    await run(`UPDATE khoa_chats SET title = ?, pinned = ?, "updatedAt" = ? WHERE id = ? AND "userId" = ?`, [body.title, body.pinned, now, id, userId]);
  } else if (body.title !== undefined) {
    await run(`UPDATE khoa_chats SET title = ?, "updatedAt" = ? WHERE id = ? AND "userId" = ?`, [body.title, now, id, userId]);
  } else if (body.pinned !== undefined) {
    await run(`UPDATE khoa_chats SET pinned = ?, "updatedAt" = ? WHERE id = ? AND "userId" = ?`, [body.pinned, now, id, userId]);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await run(`DELETE FROM khoa_chats WHERE id = ? AND "userId" = ?`, [id, userId]);
  return NextResponse.json({ success: true });
}
