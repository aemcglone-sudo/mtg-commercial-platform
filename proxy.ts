import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './lib/session';

const PUBLIC_PATHS = [
  '/login',
  '/collector/login',
  '/shop/login',
  '/admin/login',
  '/portal',
  '/api/auth/login',
  '/api/auth/portal-login',
  '/api/auth/logout',
  '/api/health',
];

const PUBLIC_PREFIXES = [
  '/register',
  '/api/auth/register',
  '/api/auth/google',
  '/api/background/',
  '/api/cron/',
  '/storefront/',
  '/api/collection/dashboard',
  '/api/expensive-cards',
  '/api/trending-cards',
  '/api/deck-wizard/themes/recommend',
  '/api/deck-wizard/commanders/suggest',
  '/api/deck-wizard/commanders/explain',
  '/api/deck-wizard/name',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('session')?.value;
  const session = token ? verifySessionToken(token) : null;

  // Not authenticated → login
  if (!session) {
    // Admin routes go to admin login
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Forced password change — locks the account to this one page until done
  if (
    session.mustChangePassword &&
    pathname !== '/portal/change-password' &&
    pathname !== '/api/auth/portal-change-password'
  ) {
    return NextResponse.redirect(new URL('/portal/change-password', request.url));
  }

  // Admin routes — only admin role
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Shop routes — only shop_owner role
  if (pathname.startsWith('/shop') && session.role !== 'shop_owner') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect already-authenticated users away from login/register pages
  const isLoginPage = ['/login', '/collector/login', '/shop/login', '/admin/login', '/portal'].includes(pathname);
  if (isLoginPage || pathname.startsWith('/register')) {
    if (session.role === 'admin') return NextResponse.redirect(new URL('/admin', request.url));
    if (session.role === 'shop_owner') return NextResponse.redirect(new URL('/shop/dashboard', request.url));
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
