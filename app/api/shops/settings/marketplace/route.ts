import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

interface ShopRow {
  id: string;
  marketplace_active: boolean;
  specialties: string[];
  hold_instructions: string;
  max_holds_per_day: number | null;
  address: string | null;
  lat: string | null;
  lng: string | null;
}

interface PrefsRow {
  notify_on_hold_request: boolean;
  notify_via_sms: boolean;
  sms_number: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<ShopRow>('SELECT id, marketplace_active, specialties, hold_instructions, max_holds_per_day, address, lat, lng FROM shops WHERE user_id = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const prefs = await findOne<PrefsRow>('SELECT notify_on_hold_request, notify_via_sms, sms_number FROM shop_notification_prefs WHERE shop_id = ?', [shop.id]);

  return NextResponse.json({
    marketplaceActive: shop.marketplace_active,
    specialties: shop.specialties ?? [],
    holdInstructions: shop.hold_instructions ?? '',
    maxHoldsPerDay: shop.max_holds_per_day,
    address: shop.address ?? '',
    lat: shop.lat ? parseFloat(shop.lat) : null,
    lng: shop.lng ? parseFloat(shop.lng) : null,
    notifyOnHoldRequest: prefs?.notify_on_hold_request ?? true,
    notifyViaSms: prefs?.notify_via_sms ?? false,
    smsNumber: prefs?.sms_number ?? '',
  });
}

export async function PATCH(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE user_id = ?', [userId]);
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const body = await req.json() as {
    marketplaceActive?: boolean;
    specialties?: string[];
    holdInstructions?: string;
    maxHoldsPerDay?: number | null;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    notifyOnHoldRequest?: boolean;
    notifyViaSms?: boolean;
    smsNumber?: string;
  };

  await run(
    `UPDATE shops SET
      marketplace_active = COALESCE(?, marketplace_active),
      specialties = COALESCE(?, specialties),
      hold_instructions = COALESCE(?, hold_instructions),
      max_holds_per_day = ?,
      address = COALESCE(?, address),
      lat = COALESCE(?, lat),
      lng = COALESCE(?, lng),
      updated_at = NOW()
    WHERE id = ?`,
    [
      body.marketplaceActive ?? null,
      body.specialties ?? null,
      body.holdInstructions ?? null,
      body.maxHoldsPerDay ?? null,
      body.address ?? null,
      body.lat ?? null,
      body.lng ?? null,
      shop.id,
    ]
  );

  if (body.notifyViaSms !== undefined || body.notifyOnHoldRequest !== undefined || body.smsNumber !== undefined) {
    await run(
      `INSERT INTO shop_notification_prefs (id, shop_id, notify_on_hold_request, notify_via_sms, sms_number)
       VALUES (gen_random_uuid(), ?, ?, ?, ?)
       ON CONFLICT (shop_id) DO UPDATE SET
         notify_on_hold_request = EXCLUDED.notify_on_hold_request,
         notify_via_sms = EXCLUDED.notify_via_sms,
         sms_number = EXCLUDED.sms_number`,
      [shop.id, body.notifyOnHoldRequest ?? true, body.notifyViaSms ?? false, body.smsNumber ?? '']
    );
  }

  return NextResponse.json({ ok: true });
}
