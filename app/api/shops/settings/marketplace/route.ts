import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, getRole } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

interface ShopRow {
  id: string;
  marketplace_active: boolean;
  specialties: string[];
  hold_instructions: string | null;
  address: string | null;
  lat: string | null;
  lng: string | null;
}

interface PrefsRow {
  sms_enabled: boolean;
  sms_number: string | null;
  email_enabled: boolean;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const shop = await findOne<ShopRow>(
      'SELECT id, marketplace_active, specialties, hold_instructions, address, lat, lng FROM shops WHERE "userId" = ?',
      [userId]
    );
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const prefs = await findOne<PrefsRow>(
      'SELECT sms_enabled, sms_number, email_enabled FROM shop_notification_prefs WHERE shop_id = ?',
      [shop.id]
    );

    return NextResponse.json({
      marketplaceActive: shop.marketplace_active,
      specialties: shop.specialties ?? [],
      holdInstructions: shop.hold_instructions ?? '',
      address: shop.address ?? '',
      lat: shop.lat ? parseFloat(shop.lat) : null,
      lng: shop.lng ? parseFloat(shop.lng) : null,
      notifyViaSms: prefs?.sms_enabled ?? false,
      smsNumber: prefs?.sms_number ?? '',
    });
  } catch (err) {
    console.error('[marketplace settings GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRole(req) !== 'shop_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const shop = await findOne<{ id: string }>('SELECT id FROM shops WHERE "userId" = ?', [userId]);
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const body = await req.json() as {
      marketplaceActive?: boolean;
      specialties?: string[];
      holdInstructions?: string;
      address?: string;
      lat?: number | null;
      lng?: number | null;
      notifyViaSms?: boolean;
      smsNumber?: string;
    };

    // Only update fields that are actually present in the body
    const sets: string[] = [];
    const vals: (string | number | boolean | null | string[])[] = [];

    if (body.marketplaceActive !== undefined) { sets.push('marketplace_active = ?'); vals.push(body.marketplaceActive); }
    if (body.specialties !== undefined)       { sets.push('specialties = ?');        vals.push(body.specialties); }
    if (body.holdInstructions !== undefined)  { sets.push('hold_instructions = ?');  vals.push(body.holdInstructions); }
    if (body.address !== undefined)           { sets.push('address = ?');            vals.push(body.address); }
    if (body.lat !== undefined)               { sets.push('lat = ?');                vals.push(body.lat); }
    if (body.lng !== undefined)               { sets.push('lng = ?');                vals.push(body.lng); }

    if (sets.length > 0) {
      sets.push('"updatedAt" = NOW()');
      vals.push(shop.id);
      await run(`UPDATE shops SET ${sets.join(', ')} WHERE id = ?`, vals);
    }

    if (body.notifyViaSms !== undefined || body.smsNumber !== undefined) {
      await run(
        `INSERT INTO shop_notification_prefs (id, shop_id, sms_enabled, sms_number)
         VALUES (gen_random_uuid(), ?, ?, ?)
         ON CONFLICT (shop_id) DO UPDATE SET
           sms_enabled = EXCLUDED.sms_enabled,
           sms_number = EXCLUDED.sms_number`,
        [shop.id, body.notifyViaSms ?? false, body.smsNumber ?? null]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[marketplace settings PATCH]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
