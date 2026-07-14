import { NextRequest, NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { findMany } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const status = req.nextUrl.searchParams.get('status') ?? 'pending';

  const claims = await findMany(
    `SELECT
       scr.*,
       ds.name AS store_name,
       ds.address AS store_address,
       ds.city AS store_city,
       u.username AS requester_username,
       u.email AS requester_email
     FROM store_claim_requests scr
     JOIN discovered_stores ds ON ds.id = scr.discovered_store_id
     JOIN users u ON u.id = scr.requesting_user_id
     WHERE scr.status = ?
     ORDER BY scr.created_at DESC`,
    [status]
  );

  return NextResponse.json({ claims });
}
