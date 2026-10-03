import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request});
  response.headers.set('Cache-Control', 'private, no-store');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return response;
  const supabase = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production'},
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({name, value}) => request.cookies.set(name, value));
        response = NextResponse.next({request});
        values.forEach(({name, value, options}) => response.cookies.set(name, value, options));
        response.headers.set('Cache-Control', 'private, no-store');
      },
    },
  });
  // Refresh only. Each protected page/API independently verifies the current user.
  await supabase.auth.getClaims();
  return response;
}
export const config = {matcher: ['/espace', '/gestion', '/application-contenu', '/api/config', '/api/progress', '/api/admin', '/api/checkout']};
