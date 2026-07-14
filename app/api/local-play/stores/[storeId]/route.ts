import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, findMany } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { storeId } = await params;

  const store = await findOne<{
    id: string; name: string; slug: string; address: string | null; city: string | null;
    state: string | null; zip: string | null; lat: string; lng: string; phone: string | null;
    website_url: string | null; hours_raw: string | null; hours: unknown;
    is_active: boolean; grimoire_shop_id: string | null; sync_source: string | null;
    last_verified_at: string | null; is_partner: boolean; inventory_count: number;
  }>(
    `SELECT ds.*,
       (ds.grimoire_shop_id IS NOT NULL) AS is_partner,
       COALESCE((
         SELECT COUNT(*) FROM shop_inventory si WHERE si."shopId" = ds.grimoire_shop_id
       ), 0)::int AS inventory_count
     FROM discovered_stores ds
     WHERE ds.id = ?`,
    [storeId]
  );

  if (!store) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const events = await findMany(
    `SELECT le.* FROM local_events le
     WHERE (le.discovered_store_id = ? OR le.grimoire_shop_id = ?)
       AND le.is_active = true
     ORDER BY le.specific_date ASC NULLS LAST, le.day_of_week ASC`,
    [storeId, store.grimoire_shop_id ?? '']
  );

  return NextResponse.json({ store, events });
}
