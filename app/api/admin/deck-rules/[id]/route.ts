import { NextRequest, NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { run } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const allowed = ['rule_text', 'category', 'scope', 'enforcement', 'active', 'sort_order', 'notes'];
  const fields = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) return NextResponse.json({ ok: true });
  const sets = fields.map(f => `"${f}" = ?`).join(', ');
  const values = fields.map(f => body[f] as string | number | boolean | null);
  await run(`UPDATE deck_rules SET ${sets}, updated_at = NOW() WHERE id = ?`, [...values, id]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (getRole(req) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  await run(`DELETE FROM deck_rules WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
