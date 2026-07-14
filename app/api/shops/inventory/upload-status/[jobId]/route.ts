import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const userId = getAuthenticatedUserId(req);
  if (!userId || getRole(req) !== 'shop_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { jobId } = await params;
  const job = await findOne<{
    status: string; total: number | null; added: number | null;
    skipped: number | null; error_msg: string | null; not_found_names: string | null;
  }>(
    `SELECT j.status, j.total, j.added, j.skipped, j.error_msg, j.not_found_names
     FROM inventory_upload_jobs j
     JOIN shops s ON s.id = j.shop_id
     WHERE j.id = ? AND s."userId" = ?`,
    [jobId, userId]
  );

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    ...job,
    notFoundNames: job.not_found_names ? JSON.parse(job.not_found_names) as string[] : [],
  });
}
