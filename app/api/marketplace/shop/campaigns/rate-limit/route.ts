import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

function isoWeek(d: Date): { week: number; year: number } {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
    year: tmp.getUTCFullYear(),
  };
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ used: 0, limit: 3, resetsAt: null });

  const { week, year } = isoWeek(new Date());

  const used = await findOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM shop_campaigns
     WHERE shop_id = ? AND status = 'sent' AND week_number = ? AND week_year = ?`,
    [shop.id, week, year]
  );

  const prefs = await findOne<{ campaigns_per_week: string }>(
    `SELECT COALESCE(campaigns_per_week, 3)::text AS campaigns_per_week FROM shop_notification_prefs WHERE shop_id = ?`,
    [shop.id]
  );

  // Reset is next Monday 00:00 UTC
  const now = new Date();
  const dayOfWeek = now.getUTCDay() || 7;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + (8 - dayOfWeek));
  nextMonday.setUTCHours(0, 0, 0, 0);

  return NextResponse.json({
    used: parseInt(used?.count ?? '0'),
    limit: parseInt(prefs?.campaigns_per_week ?? '3'),
    resetsAt: nextMonday.toISOString(),
  });
}
