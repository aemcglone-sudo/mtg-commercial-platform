import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './lib/session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('session')?.value;
  const session = token ? verifySessionToken(token) : null;

  // Admin routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!session || session.role !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  // Shop owner routes
  if (pathname.startsWith('/shop')) {
    if (!session || session.role !== 'shop_owner') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Collector-accessible routes (any authenticated user)
  if (pathname.startsWith('/collection') || pathname.startsWith('/decks')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Redirect already-authenticated users away from login/register
  if (pathname === '/login' || pathname.startsWith('/register')) {
    if (session) {
      if (session.role === 'admin') return NextResponse.redirect(new URL('/admin', req.url));
      if (session.role === 'shop_owner') return NextResponse.redirect(new URL('/shop/dashboard', req.url));
      return NextResponse.redirect(new URL('/collection', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/shop/:path*',
    '/collection/:path*',
    '/decks/:path*',
    '/login',
    '/register/:path*',
  ],
};
