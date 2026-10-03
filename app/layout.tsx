import type {Metadata} from 'next';
import './globals.css';
import './marketing.css';
export const metadata:Metadata={title:'FrancoRoute — Autoécole à London, Ontario',description:'Une approche sociale et humaine au cœur de votre réussite. Programme BDE, préparation G1 et accompagnement G2/G Full. Réservez un premier appel de 15 minutes.',icons:{icon:'/francoroute-logo.png',shortcut:'/francoroute-logo.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}