import Login from '@/components/login';
import {authReady} from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Connexion · FrancoRoute', robots: {index: false, follow: false}};
export default async function Page({searchParams}: {searchParams: Promise<{next?: string}>}) {
  const requested = (await searchParams).next;
  const next = ['/espace', '/pratique', '/gestion', '/application#acces'].includes(requested || '') ? requested! : '/espace';
  return <Login ready={authReady()} next={next}/>;
}
