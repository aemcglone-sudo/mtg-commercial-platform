import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow access to login and public routes
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/api/auth/verify-passcode') ||
    pathname === '/api/collection/dashboard' ||
    pathname === '/api/expensive-cards' ||
    pathname === '/api/trending-cards' ||
    pathname.startsWith('/api/background/')
  ) {
    return NextResponse.next();
  }

  // Check for auth token
  const authToken = request.cookies.get('auth_token');

  if (!authToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth/verify-passcode (already handled above)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
