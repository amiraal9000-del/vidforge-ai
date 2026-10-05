import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function proxy(request: Request) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { request, response: res }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = new URL(request.url);

  const publicPaths = ['/login', '/signup'];
  const isPublic = publicPaths.includes(pathname);

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (user && isPublic) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};