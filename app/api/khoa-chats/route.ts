import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany, run } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const chats = await findMany<{ id: string; title: string; pinned: boolean; updatedAt: string }>(
    `SELECT id, title, pinned, "updatedAt" FROM khoa_chats WHERE "userId" = ? ORDER BY pinned DESC, "updatedAt" DESC LIMIT 50`,
    [userId]
  );

  return NextResponse.json(chats);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, title, messages } = await req.json() as { id: string; title: string; messages: unknown[] };
  if (!id || !title || !messages) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const now = new Date().toISOString();
  await run(
    `INSERT INTO khoa_chats (id, "userId", title, messages, pinned, "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, false, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       messages = EXCLUDED.messages,
       "updatedAt" = EXCLUDED."updatedAt"`,
    [id, userId, title, JSON.stringify(messages), now, now]
  );

  return NextResponse.json({ id, title });
}
