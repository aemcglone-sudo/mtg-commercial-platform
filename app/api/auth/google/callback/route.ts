import { NextRequest, NextResponse } from 'next/server';
import { findOne, run } from '@/lib/db';
import { setSessionCookie, Session } from '@/lib/session';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'aemcglone@gmail.com';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  error?: string;
}

interface GoogleUserInfo {
  sub: string;        // Google user ID
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  allowed_roles: string[];
  avatar_url: string | null;
  name: string | null;
}

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${base}/login?error=google_denied`);
  }

  let returnTo = '/';
  try {
    if (stateRaw) {
      const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString()) as { returnTo?: string };
      returnTo = parsed.returnTo ?? '/';
    }
  } catch { /* ignore bad state */ }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${base}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json() as GoogleTokenResponse;
  if (tokens.error || !tokens.access_token) {
    return NextResponse.redirect(`${base}/login?error=google_token`);
  }

  // Fetch user profile
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json() as GoogleUserInfo;

  if (!profile.email_verified || !profile.email) {
    return NextResponse.redirect(`${base}/login?error=email_unverified`);
  }

  const email = profile.email.toLowerCase();
  const isAdmin = email === ADMIN_EMAIL;

  // Upsert user
  let user = await findOne<UserRow>(
    `SELECT id, email, role, allowed_roles, "avatarUrl" AS avatar_url, name
     FROM users WHERE "googleId" = ? OR email = ?`,
    [profile.sub, email]
  );

  if (!user) {
    // New user — create as collector (or admin if it's the admin email)
    const role = isAdmin ? 'admin' : 'collector';
    const allowedRoles = isAdmin ? ['collector', 'shop_owner', 'admin'] : ['collector'];
    const id = randomUUID();
    await run(
      `INSERT INTO users (id, username, email, "googleId", "avatarUrl", name, role, allowed_roles, "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, email, email, profile.sub, profile.picture, profile.name,
       role, `{${allowedRoles.join(',')}}`]
    );
    user = await findOne<UserRow>(
      `SELECT id, email, role, allowed_roles, "avatarUrl" AS avatar_url, name FROM users WHERE id = ?`,
      [id]
    );
  } else {
    // Existing user — sync googleId and avatar if not set
    const updates: string[] = [];
    const vals: (string | null)[] = [];

    if (!user.avatar_url && profile.picture) {
      updates.push('"avatarUrl" = ?'); vals.push(profile.picture);
    }
    updates.push('"googleId" = ?'); vals.push(profile.sub);

    // Ensure admin always has all roles
    if (isAdmin) {
      updates.push('allowed_roles = ?'); vals.push('{collector,shop_owner,admin}');
      updates.push('role = ?'); vals.push('admin');
    }

    if (updates.length > 0) {
      vals.push(user.id);
      await run(`UPDATE users SET ${updates.join(', ')}, "updatedAt" = NOW() WHERE id = ?`, vals);
      user = await findOne<UserRow>(
        `SELECT id, email, role, allowed_roles, "avatarUrl" AS avatar_url, name FROM users WHERE id = ?`,
        [user.id]
      );
    }
  }

  if (!user) return NextResponse.redirect(`${base}/login?error=user_create`);

  const session: Session = {
    userId: user.id,
    role: user.role as Session['role'],
    email: user.email,
  };

  const destination = roleHome(user.role) ?? returnTo;
  const res = NextResponse.redirect(`${base}${destination}`);
  setSessionCookie(res, session);
  return res;
}

function roleHome(role: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'shop_owner') return '/shop/dashboard';
  return '/';
}
