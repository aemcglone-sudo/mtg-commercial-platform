import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, findMany, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function resolveShop(req: NextRequest, shopId: string) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return null;
  return await findOne<{ id: string }>(`SELECT id FROM shops WHERE id = ? AND "userId" = ?`, [shopId, userId]);
}

interface EventRow {
  id: string; title: string; description: string | null; event_type: string | null;
  starts_at: string; ends_at: string | null; is_recurring: boolean; recurrence_rule: string | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await resolveShop(req, shopId);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const events = await findMany<EventRow>(
    `SELECT id, title, description, event_type, starts_at::text, ends_at::text, is_recurring, recurrence_rule
     FROM shop_events WHERE shop_id = ? ORDER BY starts_at ASC`,
    [shopId]
  );

  return NextResponse.json({ events: events.map(e => ({
    id: e.id, title: e.title, description: e.description,
    eventType: e.event_type, startsAt: e.starts_at, endsAt: e.ends_at,
    isRecurring: e.is_recurring, recurrenceRule: e.recurrence_rule,
  })) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await resolveShop(req, shopId);
  if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    title: string; description?: string; eventType?: string;
    startsAt: string; endsAt?: string; isRecurring?: boolean; recurrenceRule?: string;
  };
  if (!body.title || !body.startsAt) return NextResponse.json({ error: 'title and startsAt required' }, { status: 400 });

  await run(
    `INSERT INTO shop_events (shop_id, title, description, event_type, starts_at, ends_at, is_recurring, recurrence_rule)
     VALUES (?, ?, ?, ?, ?::timestamptz, ?::timestamptz, ?, ?)`,
    [shopId, body.title, body.description ?? null, body.eventType ?? null, body.startsAt, body.endsAt ?? null,
     body.isRecurring ?? false, body.recurrenceRule ?? null]
  );

  return NextResponse.json({ ok: true });
}
