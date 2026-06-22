import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany, run } from '@/lib/db';
import { randomUUID } from 'crypto';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

interface StoredChat {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const chats = await findMany<any>(
      `SELECT id, title, "createdAt", "updatedAt" FROM khoa_chats WHERE "userId" = ? ORDER BY "updatedAt" DESC LIMIT 50`,
      [userId]
    );

    return NextResponse.json(chats);
  } catch (err) {
    console.error('Failed to fetch chats:', err);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, title, messages } = body;

    if (!id || !title || !messages) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const messagesJson = JSON.stringify(messages);

    await run(
      `INSERT INTO khoa_chats (id, "userId", title, messages, "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         messages = EXCLUDED.messages,
         "updatedAt" = EXCLUDED."updatedAt"`,
      [id, userId, title, messagesJson, now, now]
    );

    return NextResponse.json({ id, title });
  } catch (err) {
    console.error('Failed to save chat:', err);
    return NextResponse.json({ error: 'Failed to save chat' }, { status: 500 });
  }
}
