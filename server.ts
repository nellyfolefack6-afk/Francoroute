import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

export const authReady = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
export async function authClient() {
  if (!authReady()) throw new Error('Account service unavailable');
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production'},
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {values.forEach(({name, value, options}) => jar.set(name, value, options));}
        catch { /* A Server Component is read-only; proxy.ts refreshes its cookies. */ }
      },
    },
  });
}
