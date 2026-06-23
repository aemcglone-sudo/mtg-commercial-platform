import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/register',
  '/api/auth/verify-passcode',
  '/api/collection/dashboard',
  '/api/expensive-cards',
  '/api/trending-cards',
  '/api/health',
];

const PUBLIC_PREFIXES = [
  '/api/background/',
  '/storefront/',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const role = request.cookies.get('auth_token')?.value;

  if (!role || (role !== 'enthusiast' && role !== 'shop_owner')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Shop owner routes — enthusiasts blocked
  if (pathname.startsWith('/shop') && role !== 'shop_owner') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
