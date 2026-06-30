import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface StatsRow {
  total_requested: string;
  confirmed_count: string;
  completed_count: string;
  avg_response_minutes: string;
  revenue_cents: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  const role = getRole(req);
  if (!userId || role !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<{ id: string }>(`SELECT id FROM shops WHERE "userId" = ?`, [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const stats = await findOne<StatsRow>(
    `SELECT
       COUNT(*)::text AS total_requested,
       COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))::text AS confirmed_count,
       COUNT(*) FILTER (WHERE status = 'completed')::text AS completed_count,
       AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 60)
         FILTER (WHERE confirmed_at IS NOT NULL)::text AS avg_response_minutes,
       COALESCE(SUM(price_cents) FILTER (WHERE status = 'completed'), 0)::text AS revenue_cents
     FROM holds WHERE shop_id = ?`,
    [shop.id]
  );

  const total = parseInt(stats?.total_requested ?? '0');
  const confirmed = parseInt(stats?.confirmed_count ?? '0');
  const completed = parseInt(stats?.completed_count ?? '0');

  return NextResponse.json({
    totalRequested: total,
    confirmedRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
    completedRate: confirmed > 0 ? Math.round((completed / confirmed) * 100) : 0,
    avgResponseTimeMinutes: stats?.avg_response_minutes ? Math.round(parseFloat(stats.avg_response_minutes)) : null,
    revenueFromHoldsCents: parseInt(stats?.revenue_cents ?? '0'),
  });
}
