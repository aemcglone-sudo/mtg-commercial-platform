import { run, findOne } from '@/lib/db';
import { randomUUID } from 'crypto';
import { sendSms } from './sms';

interface NotificationPayload {
  title: string;
  body: string;
  holdId?: string;
  campaignId?: string;
  scryfallId?: string;
  shopId?: string;
  ctaUrl?: string;
}

export async function createNotification(
  userId: string,
  type: string,
  payload: NotificationPayload
): Promise<void> {
  try {
    await run(
      `INSERT INTO notifications (id, user_id, type, title, body, hold_id, campaign_id, scryfall_id, shop_id, cta_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(), userId, type,
        payload.title, payload.body,
        payload.holdId ?? null, payload.campaignId ?? null,
        payload.scryfallId ?? null, payload.shopId ?? null,
        payload.ctaUrl ?? null,
      ]
    );
  } catch (e) {
    console.error('[notify] Failed to create notification:', e);
  }
}

interface CollectorPrefsRow {
  sms_enabled: boolean;
  sms_number: string;
}

// Send notification via all enabled channels for a collector
export async function notifyCollector(
  userId: string,
  type: string,
  payload: NotificationPayload,
  smsBody?: string
): Promise<void> {
  await createNotification(userId, type, payload);

  if (smsBody) {
    const prefs = await findOne<CollectorPrefsRow>(
      `SELECT sms_enabled, sms_number FROM collector_notification_prefs WHERE user_id = ?`,
      [userId]
    );
    if (prefs?.sms_enabled && prefs.sms_number) {
      await sendSms(prefs.sms_number, smsBody).catch(e =>
        console.error('[notify] SMS to collector failed:', e)
      );
    }
  }
}

interface ShopPrefsRow {
  sms_enabled: boolean;
  sms_number: string;
  app_enabled: boolean;
}

// Send notification to shop owner via SMS + in-app
export async function notifyShopOwner(
  shopId: string,
  ownerUserId: string,
  type: string,
  payload: NotificationPayload,
  smsBody?: string
): Promise<void> {
  const prefs = await findOne<ShopPrefsRow>(
    `SELECT sms_enabled, sms_number, app_enabled FROM shop_notification_prefs WHERE shop_id = ?`,
    [shopId]
  );

  if (!prefs || prefs.app_enabled) {
    await createNotification(ownerUserId, type, payload);
  }

  if (smsBody && (!prefs || prefs.sms_enabled) && prefs?.sms_number) {
    await sendSms(prefs.sms_number, smsBody).catch(e =>
      console.error('[notify] SMS to shop owner failed:', e)
    );
  }
}

