import { NextRequest, NextResponse } from 'next/server';

type Role = 'enthusiast' | 'shop_owner';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passcode, role } = body as { passcode?: string; role?: Role };

  if (!passcode || !role) {
    return NextResponse.json({ error: 'Passcode and role required' }, { status: 400 });
  }

  const expected =
    role === 'shop_owner'
      ? process.env.PASSCODE_SHOP_OWNER
      : process.env.PASSCODE_ENTHUSIAST;

  if (!expected || passcode !== expected) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true, role });

  response.cookies.set('auth_token', role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
