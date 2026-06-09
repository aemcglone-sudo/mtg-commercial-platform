import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes that never need auth
  const publicPaths = ['/login', '/register', '/api/auth'];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from login/register
  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
