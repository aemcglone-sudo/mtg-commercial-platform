const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 8) return `+${digits}`;
  return null;
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[sms] Twilio not configured — skipping SMS');
    return;
  }
  const normalized = normalizePhone(to);
  if (!normalized) {
    console.warn('[sms] Invalid phone number format:', to);
    return;
  }
  to = normalized;

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${fromNumber}`, Body: body }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[sms] Twilio error:', res.status, err.slice(0, 200));
  }
}

interface HoldSmsContext {
  cardName: string;
  condition: string;
  foil: boolean;
  priceCents: number;
  pickupWindow?: string | null;
  collectorNote?: string | null;
  holdId: string;
}

export function holdRequestedSms(ctx: HoldSmsContext, shopName: string, shopAddress?: string): string {
  const price = `$${(ctx.priceCents / 100).toFixed(2)}`;
  const card = `${ctx.cardName} (${ctx.condition}${ctx.foil ? ' Foil' : ''})`;
  return [
    `New hold request — ${shopName}`,
    `Card: ${card} · ${price}`,
    ctx.pickupWindow ? `Pickup window: ${ctx.pickupWindow}` : null,
    ctx.collectorNote ? `Note: "${ctx.collectorNote}"` : null,
    shopAddress ? `📍 ${shopAddress}` : null,
  ].filter(l => l !== null).join('\n');
}

export function holdGroupRequestedSms(
  holds: HoldSmsContext[],
  shopName: string,
  pickupWindow?: string | null,
  collectorNote?: string | null
): string {
  const lines = holds.map(h => `• ${h.cardName} (${h.condition}) $${(h.priceCents / 100).toFixed(2)}`);
  return [
    `Grimoire Hold — ${holds.length} cards at ${shopName}`,
    ...lines,
    pickupWindow ? `Pickup: ${pickupWindow}` : null,
    collectorNote ? `Note: ${collectorNote}` : null,
    ``,
    `Manage: grimoire.gg/shop/holds`,
  ].filter(l => l !== null).join('\n');
}

export function holdCancelledSms(cardName: string, condition: string): string {
  return `Grimoire: Hold cancelled\n${cardName} (${condition}) hold was cancelled by the collector.`;
}

export function cardAvailableSms(cardName: string, shopName: string, condition: string, priceCents: number, distanceMiles: number): string {
  return `Grimoire: ${cardName} is available locally\n${shopName} has it in ${condition} for $${(priceCents / 100).toFixed(2)} · ${distanceMiles.toFixed(1)} mi away\ngrimoire.gg/marketplace/find`;
}

export function holdConfirmedSms(cardName: string, shopName: string): string {
  return `Grimoire: Hold confirmed!\n${shopName} has your ${cardName} ready for pickup. See you soon!`;
}

export function holdDeclinedSms(cardName: string, shopName: string, note?: string | null): string {
  return `Grimoire: Hold unavailable\n${shopName}: ${note ?? 'Card no longer available'}. Try another store at grimoire.gg/marketplace/find`;
}
