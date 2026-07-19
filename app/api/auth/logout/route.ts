import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export async function POST() {
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}

export async function GET() {
  const res = NextResponse.redirect(new URL('/login?signed-out=1', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'));
  clearSessionCookie(res);
  return res;
}
