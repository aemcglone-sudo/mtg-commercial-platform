import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { findOne, run } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface PrefsRow {
  id: string; availability_alerts: boolean; campaign_notifications: boolean;
  hold_notifications: boolean; search_radius_miles: string; opted_out_shops: string[];
  lat: string; lng: string; location_updated_at: string; sms_enabled: boolean; sms_number: string;
}

export async function GET(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prefs = await findOne<PrefsRow>(
    `SELECT availability_alerts, campaign_notifications, hold_notifications,
            search_radius_miles::text, opted_out_shops, lat::text, lng::text,
            location_updated_at::text, sms_enabled, sms_number
     FROM collector_notification_prefs WHERE user_id = ?`,
    [userId]
  );

  if (!prefs) {
    return NextResponse.json({
      availabilityAlerts: true, campaignNotifications: true, holdNotifications: true,
      searchRadiusMiles: 50, optedOutShops: [], lat: null, lng: null,
      smsEnabled: false, smsNumber: null,
    });
  }

  return NextResponse.json({
    availabilityAlerts: prefs.availability_alerts,
    campaignNotifications: prefs.campaign_notifications,
    holdNotifications: prefs.hold_notifications,
    searchRadiusMiles: parseInt(prefs.search_radius_miles),
    optedOutShops: prefs.opted_out_shops ?? [],
    lat: prefs.lat ? parseFloat(prefs.lat) : null,
    lng: prefs.lng ? parseFloat(prefs.lng) : null,
    locationUpdatedAt: prefs.location_updated_at,
    smsEnabled: prefs.sms_enabled,
    smsNumber: prefs.sms_number,
  });
}

export async function PATCH(req: NextRequest) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    availabilityAlerts?: boolean;
    campaignNotifications?: boolean;
    holdNotifications?: boolean;
    searchRadiusMiles?: number;
    lat?: number;
    lng?: number;
    smsEnabled?: boolean;
    smsNumber?: string;
  };

  const existing = await findOne<{ id: string }>(
    `SELECT id FROM collector_notification_prefs WHERE user_id = ?`, [userId]
  );

  if (!existing) {
    await run(
      `INSERT INTO collector_notification_prefs
         (id, user_id, availability_alerts, campaign_notifications, hold_notifications,
          search_radius_miles, lat, lng, location_updated_at, sms_enabled, sms_number)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        randomUUID(), userId,
        body.availabilityAlerts ?? true,
        body.campaignNotifications ?? true,
        body.holdNotifications ?? true,
        body.searchRadiusMiles ?? 50,
        body.lat ?? null, body.lng ?? null,
        (body.lat != null) ? new Date().toISOString() : null,
        body.smsEnabled ?? false,
        body.smsNumber ?? null,
      ]
    );
  } else {
    const sets: string[] = [];
    const vals: (string | number | boolean | null)[] = [];

    if (body.availabilityAlerts !== undefined) { sets.push('availability_alerts = ?'); vals.push(body.availabilityAlerts); }
    if (body.campaignNotifications !== undefined) { sets.push('campaign_notifications = ?'); vals.push(body.campaignNotifications); }
    if (body.holdNotifications !== undefined) { sets.push('hold_notifications = ?'); vals.push(body.holdNotifications); }
    if (body.searchRadiusMiles !== undefined) { sets.push('search_radius_miles = ?'); vals.push(body.searchRadiusMiles); }
    if (body.smsEnabled !== undefined) { sets.push('sms_enabled = ?'); vals.push(body.smsEnabled); }
    if (body.smsNumber !== undefined) { sets.push('sms_number = ?'); vals.push(body.smsNumber); }
    if (body.lat !== undefined && body.lng !== undefined) {
      sets.push('lat = ?', 'lng = ?', 'location_updated_at = NOW()');
      vals.push(body.lat, body.lng);
    }

    if (sets.length > 0) {
      sets.push('updated_at = NOW()');
      vals.push(userId);
      await run(`UPDATE collector_notification_prefs SET ${sets.join(', ')} WHERE user_id = ?`, vals);
    }
  }

  return NextResponse.json({ ok: true });
}
