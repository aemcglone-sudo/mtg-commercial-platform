import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findMany, findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface NotifRow {
  id: string; type: string; title: string; body: string;
  hold_id: string; campaign_id: string; scryfall_id: string; shop_id: string;
  cta_url: string; read: boolean; read_at: string; created_at: string;
}

interface UnreadRow { count: string }

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const unreadOnly = searchParams.get('unread_only') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 30;
  const offset = (page - 1) * limit;

  const rows = await findMany<NotifRow>(
    `SELECT id, type, title, body, hold_id, campaign_id, scryfall_id, shop_id,
            cta_url, read, read_at::text, created_at::text
     FROM notifications
     WHERE user_id = ? ${unreadOnly ? 'AND read = false' : ''}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const unreadCount = await findOne<UnreadRow>(
    `SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = ? AND read = false`,
    [userId]
  );

  return NextResponse.json({ notifications: rows, unreadCount: parseInt(unreadCount?.count ?? '0'), page });
}
