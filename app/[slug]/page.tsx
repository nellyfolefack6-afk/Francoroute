import {notFound,redirect} from 'next/navigation';
import Website from '@/components/website';
const titles:Record<string,string>={'programme-bde':'Programme BDE',tarifs:'Nos tarifs',application:'G1, G2 et G Full',reserver:'Réserver un premier appel',contact:'Contact',confidentialite:'Confidentialité',conditions:'Conditions',annuler:'Annuler un rendez-vous','a-propos':'À propos de nous',temoignages:'Témoignages'};
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return {title:(titles[slug]||'FrancoRoute')+' · FrancoRoute'}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(slug==='valeurs')redirect('/a-propos');if(slug==='mon-espace')redirect('/espace');if(slug==='accueil')redirect('/');if(!titles[slug])notFound();return <Website page={slug}/>;}
