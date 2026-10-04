import 'server-only';
import {getFrancoRouteUser} from '@/lib/identity';
import {db} from '@/db';
import {databaseFailure} from '@/lib/database-config.mjs';
export const now=()=>Math.floor(Date.now()/1000);
export const cfg=()=>process.env as Record<string,string>;
export function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function api(fn:()=>Promise<Response>){try{return await fn()}catch(e){const x=e as Error&{status?:number};if(!x.status)console.error('FrancoRoute service failure:',databaseFailure(x));return json({error:x.status?x.message:'Le service est momentanément indisponible. Réessayez dans quelques instants.'},x.status||503)}}
export function sameOrigin(r:Request){
 // Netlify can supply an internal request URL. Only trust our configured
 // public origin; never derive permission from forwarded or Host headers.
 const c=cfg();
 const preview=c.NETLIFY==='true'&&!!c.CONTEXT&&c.CONTEXT!=='production';
 const target=(preview?c.DEPLOY_PRIME_URL:undefined)||c.SITE_ORIGIN||r.url;
 let expected:string;
 try{expected=new URL(target).origin}catch{fail('Le site doit être configuré par FrancoRoute.',503)}
 if(r.headers.get('origin')!==expected)fail('Requête non autorisée.',403);
}
export async function body(r:Request){if(Number(r.headers.get('content-length')||0)>150000)fail('Formulaire trop volumineux.',413);const raw=await r.text();if(raw.length>150000)fail('Formulaire trop volumineux.',413);try{return JSON.parse(raw)}catch{fail('Formulaire invalide.')}}
export async function user(){const u=await getFrancoRouteUser();if(!u)fail('Connectez-vous pour continuer.',401);return u}
export const adminEmail=(email:string)=>(cfg().ADMIN_EMAILS||'').toLowerCase().split(',').map(x=>x.trim()).includes(email.toLowerCase());
export async function admin(){const u=await user();if(!adminEmail(u.email))fail('Cet espace est réservé à FrancoRoute.',403);return u}
export async function entitlement(userId:string){return db().prepare("SELECT MAX(expires) AS expires FROM purchases WHERE user_id=? AND status='paid' AND expires>?").bind(userId,now()).first<{expires:number|null}>()}
export async function paid(){const u=await user();if(!adminEmail(u.email)&&!(await entitlement(u.userId))?.expires)fail('Votre accès n’est pas actif.',402);return u}
export async function hash(v:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function rate(key:string,max:number,seconds:number){const t=now();const r=await db().prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN limits.expires<? THEN 1 ELSE limits.count+1 END,expires=CASE WHEN limits.expires<? THEN excluded.expires ELSE limits.expires END RETURNING count').bind(key,t+seconds,t,t).first<{count:number}>();if((r?.count||0)>max)fail('Trop de tentatives. Réessayez un peu plus tard.',429)}
export function paymentReady(){const c=cfg();return Boolean(c.STRIPE_SECRET_KEY&&c.STRIPE_WEBHOOK_SECRET&&c.SITE_ORIGIN&&c.DATABASE_URL&&c.SUPABASE_URL&&c.SUPABASE_PUBLISHABLE_KEY&&c.PAYMENT_TAX_MODE==='exclusive')}
export async function stripe(path:string,p?:URLSearchParams,key?:string){if(!cfg().STRIPE_SECRET_KEY)fail('Le paiement en ligne n’est pas encore ouvert.',503);const r=await fetch('https://api.stripe.com/v1/'+path,{method:p?'POST':'GET',headers:{Authorization:'Bearer '+cfg().STRIPE_SECRET_KEY,...(p?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},body:p});const data=await r.json() as any;if(!r.ok){console.error('Stripe unavailable',r.status,data.error?.code);fail('Le paiement est indisponible pour le moment.',502)}return data}
export async function fulfill(s:any){if(s.mode!=='payment'||s.payment_status!=='paid'||s.currency!=='cad'||s.amount_subtotal!==2800||s.metadata?.product!=='francoroute-21days'||s.metadata?.access_days!=='21'||!s.client_reference_id)return false;const t=now();await db().prepare("INSERT INTO purchases(id,user_id,payment_intent,starts,expires,status) VALUES(?,?,?,?,?,'paid') ON CONFLICT(id) DO NOTHING").bind(s.id,s.client_reference_id,typeof s.payment_intent==='string'?s.payment_intent:s.payment_intent?.id||null,t,t+21*86400).run();return true}
