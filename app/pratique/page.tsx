import {getFrancoRouteUser} from '@/lib/identity';
import {Header,Footer} from '@/components/website';
import PracticeBooking from '@/components/practice-booking';
export const dynamic='force-dynamic';
export const metadata={title:'Mes heures de pratique · FrancoRoute',robots:{index:false,follow:false}};
export default async function Page(){const u=await getFrancoRouteUser();return <><Header/><main id="main" className="container section">{u?<PracticeBooking/>:<><div className="eyebrow">Mon espace · Conduite</div><h1>Réserver mes heures de pratique</h1><p className="lead">Connectez-vous avec le courriel utilisé lors du paiement de vos leçons pour retrouver vos heures et choisir vos cours.</p><a className="cta" href="/connexion?next=%2Fpratique">Me connecter pour réserver</a></>}</main><Footer/></>;}
