import 'server-only';
import {authClient, authReady} from '@/lib/supabase/server';
export type FrancoRouteUser = {userId: string; email: string};
export async function getFrancoRouteUser(): Promise<FrancoRouteUser | null> {
  if (!authReady()) return null;
  // Verify the cookie-backed token with the authentication server on every protected request.
  // Never accept an identity from request headers, form fields or local storage.
  const {data: {user}, error} = await (await authClient()).auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at) return null;
  return {userId: user.id, email: user.email.trim().toLowerCase()};
}
