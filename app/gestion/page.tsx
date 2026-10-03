import {getFrancoRouteUser} from '@/lib/identity';
import {adminEmail} from '@/lib/server';
import {Header,Footer} from '@/components/website';
import AdminPanel from '@/components/admin-panel';
import PracticeAdmin from '@/components/practice-admin';
export const dynamic='force-dynamic';
export const metadata={title:'Gestion des premiers appels · FrancoRoute',robots:{index:false,follow:false}};
export default async function Page(){const u=await getFrancoRouteUser();return <><Header/><main id="main" className="container section">{u&&adminEmail(u.email)?<><PracticeAdmin/><AdminPanel/></>:<><h1>{u?'Accès réservé':'Votre espace de gestion'}</h1><p className="lead">Connectez-vous avec le compte propriétaire de FrancoRoute pour ouvrir les disponibilités et consulter les réservations.</p><div className="actions"><a className="cta" href="/connexion?next=%2Fgestion" target="_top">Me connecter</a><a className="text-link" href="/reserver">Voir le calendrier</a></div></>}</main><Footer/></>}