import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { user } } = await supabase.auth.getUser();

  // If NOT logged in AND NOT on auth pages → send to login
  if (!user && !req.nextUrl.pathname.startsWith('/login') && !req.nextUrl.pathname.startsWith('/signup')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // If logged in AND on auth pages → send to home
  if (user && ['/login', '/signup'].includes(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};