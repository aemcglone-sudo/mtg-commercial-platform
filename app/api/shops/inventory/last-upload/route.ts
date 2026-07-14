import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const job = await findOne<{
    status: string; total: number | null; added: number | null;
    skipped: number | null; not_found_names: string | null;
  }>(
    `SELECT j.status, j.total, j.added, j.skipped, j.not_found_names
     FROM inventory_upload_jobs j
     JOIN shops s ON s.id = j.shop_id
     WHERE s."userId" = ? AND j.status = 'done'
     ORDER BY j.updated_at DESC LIMIT 1`,
    [userId]
  );

  if (!job) return NextResponse.json({ notFoundNames: [] });
  return NextResponse.json({
    added: job.added,
    skipped: job.skipped,
    total: job.total,
    notFoundNames: job.not_found_names ? JSON.parse(job.not_found_names) as string[] : [],
  });
}
