import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = `${base}/api/auth/google/callback`;

  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? '/';
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
