import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function proxy(request: Request) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie');
          if (!cookieHeader) return [];
          return cookieHeader.split('; ').map(cookie => {
            const [name, ...rest] = cookie.split('=');
            return { name, value: rest.join('=') };
          });
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = new URL(request.url);

  // Only protect the GENERATOR page — NOT the homepage
  const protectedPaths = ['/generate', '/dashboard', '/history'];
  const isProtected = protectedPaths.some(p => pathname.startsWith(p));
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/generate', request.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};