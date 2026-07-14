import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prefs = await findOne(
    `SELECT * FROM collector_location_prefs WHERE user_id = ?`,
    [userId]
  );
  return NextResponse.json({ prefs });
}

export async function PATCH(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    lat?: number; lng?: number; zip?: string; city?: string; radius_miles?: number; location_method?: string;
  };

  const existing = await findOne(`SELECT id FROM collector_location_prefs WHERE user_id = ?`, [userId]);

  if (existing) {
    await run(
      `UPDATE collector_location_prefs SET
         default_lat=?, default_lng=?, default_zip=?, default_city=?,
         default_radius_miles=?, location_method=?, updated_at=NOW()
       WHERE user_id=?`,
      [
        body.lat ?? null, body.lng ?? null, body.zip ?? null, body.city ?? null,
        body.radius_miles ?? 50, body.location_method ?? 'zip', userId,
      ]
    );
  } else {
    await run(
      `INSERT INTO collector_location_prefs
         (id, user_id, default_lat, default_lng, default_zip, default_city, default_radius_miles, location_method)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        randomUUID(), userId, body.lat ?? null, body.lng ?? null, body.zip ?? null,
        body.city ?? null, body.radius_miles ?? 50, body.location_method ?? 'zip',
      ]
    );
  }

  return NextResponse.json({ ok: true });
}
