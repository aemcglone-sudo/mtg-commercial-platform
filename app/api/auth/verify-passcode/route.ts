import { NextRequest, NextResponse } from 'next/server';

const PASSCODE = 'Magic8581';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode } = body;

  if (!passcode) {
    return NextResponse.json({ error: 'Passcode required' }, { status: 400 });
  }

  if (passcode !== PASSCODE) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });

  // Set a simple session cookie (httpOnly, secure, 7 days)
  response.cookies.set('auth_token', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  return response;
}
