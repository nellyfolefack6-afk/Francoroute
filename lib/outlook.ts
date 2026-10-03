import 'server-only';
import {createCipheriv, createDecipheriv, randomBytes, createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {db, transaction} from '@/db';
import {cfg, fail, now, hash} from '@/lib/server';

const authority='https://login.microsoftonline.com/consumers/oauth2/v2.0';
const scopes='offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.ReadWrite';
const cookieName='__Host-fr-outlook';
const expectedEmail=()=> (cfg().OUTLOOK_ACCOUNT_EMAIL||'francoroute@outlook.com').toLowerCase();
export function outlookConfigured(){return Boolean(cfg().OUTLOOK_CLIENT_ID && cfg().OUTLOOK_CLIENT_SECRET && /^[A-Za-z0-9+/]{43}=$/.test(cfg().OUTLOOK_TOKEN_KEY||'') && /^https:\/\//.test(cfg().SITE_ORIGIN||''));}
const callbackUrl=()=>new URL('/api/outlook/callback',cfg().SITE_ORIGIN).href;
export function seal(value:unknown){
 const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',Buffer.from(cfg().OUTLOOK_TOKEN_KEY,'base64'),iv);
 const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64url')).join('.');
}
export function unseal(value:string):any {
 const [iv,tag,data]=value.split('.').map(s=>Buffer.from(s,'base64url'));
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(cfg().OUTLOOK_TOKEN_KEY,'base64'),iv);
 decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));
}
async function tokens(fields:Record<string,string>){
 const response=await fetch(authority+'/token',{method:'POST',signal:AbortSignal.timeout(9000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:cfg().OUTLOOK_CLIENT_ID,client_secret:cfg().OUTLOOK_CLIENT_SECRET,scope:scopes,...fields})});
 const data=await response.json();
 if(!response.ok||!data.access_token)fail('La connexion Outlook doit être renouvelée par FrancoRoute.',503);
 return data as {access_token:string;refresh_token?:string;expires_in:number};
}
export async function outlookStatus(){
 if(!outlookConfigured())return {configured:false,connected:false};
 const c=await db().prepare('SELECT account_email,calendar_name,updated FROM outlook_connection WHERE id=1').first();
 return {configured:true,connected:!!c,account:c?.account_email,calendar:c?.calendar_name};
}
export async function startOutlook(userId:string){
 if(!outlookConfigured())fail('Les paramètres Microsoft du site doivent être renseignés sur Netlify.',503);
 const state=randomBytes(32).toString('base64url'), verifier=randomBytes(48).toString('base64url');
 await db().prepare('DELETE FROM outlook_oauth WHERE expires<?').bind(now()).run();
 await db().prepare('INSERT INTO outlook_oauth(state_hash,user_id,verifier,expires) VALUES(?,?,?,?)').bind(await hash(state),userId,seal(verifier),now()+600).run();
 (await cookies()).set(cookieName,state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});
 return authority+'/authorize?'+new URLSearchParams({client_id:cfg().OUTLOOK_CLIENT_ID,response_type:'code',redirect_uri:callbackUrl(),response_mode:'query',scope:scopes,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',login_hint:expectedEmail(),prompt:'select_account'});
}
async function graphWithToken(accessToken:string,path:string,init:RequestInit={}){
 // Only documented relative Microsoft Graph paths; never follow arbitrary paging hosts.
 if(!path.startsWith('/me'))throw new Error('Invalid Graph path');
 const response=await fetch('https://graph.microsoft.com/v1.0'+path,{...init,redirect:'error',signal:AbortSignal.timeout(9000),cache:'no-store',headers:{Authorization:'Bearer '+accessToken,Prefer:'outlook.timezone="UTC", IdType="ImmutableId"','Content-Type':'application/json',...init.headers}});
 if(init.method==='DELETE' && response.status===404)return null;
 if(!response.ok)fail('Outlook est momentanément indisponible. Le créneau reste protégé jusqu’à vérification.',503);
 return response.status===204?null:response.json();
}
export async function finishOutlook(url:URL,userId:string){
 const jar=await cookies(),state=url.searchParams.get('state'), cookie=jar.get(cookieName)?.value;
 jar.delete(cookieName);
 if(!outlookConfigured()||!state||!cookie||state!==cookie)fail('Cette demande de connexion a expiré. Recommencez depuis la gestion.',400);
 const pending=await db().prepare('DELETE FROM outlook_oauth WHERE state_hash=? AND user_id=? AND expires>? RETURNING verifier').bind(await hash(state),userId,now()).first<{verifier:string}>();
 if(!pending)fail('Cette demande de connexion a expiré.',400);
 const code=url.searchParams.get('code');if(!code||url.searchParams.has('error'))fail('Connexion Outlook annulée.',400);
 const token=await tokens({grant_type:'authorization_code',code,code_verifier:unseal(pending.verifier),redirect_uri:callbackUrl()});
 const profile=await graphWithToken(token.access_token,'/me?$select=mail,userPrincipalName');
 const aliases=[profile.mail,profile.userPrincipalName].filter(Boolean).map((v:string)=>v.toLowerCase());
 if(!aliases.includes(expectedEmail()))fail('Connectez le compte '+expectedEmail()+'. Aucun autre compte ne sera relié.',403);
 const calendar=await graphWithToken(token.access_token,'/me/calendar?$select=id,name,canEdit,owner');
 if(!calendar.canEdit||!calendar.id||!token.refresh_token)fail('Ce calendrier ne permet pas la connexion demandée.',400);
 await transaction(async q=>{
  const [existing]=await q('SELECT calendar_id FROM outlook_connection WHERE id=1 FOR UPDATE');
  if(existing && existing.calendar_id!==calendar.id){const rows=await q("SELECT id FROM calendar_reservations WHERE status<>'cancelled' LIMIT 1");if(rows.length)fail('Le calendrier contient des réservations. Contactez le support avant de changer de calendrier.',409);}
  await q('INSERT INTO outlook_connection(id,account_email,calendar_id,calendar_name,credentials,expires,updated) VALUES(1,$1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET account_email=excluded.account_email,calendar_id=excluded.calendar_id,calendar_name=excluded.calendar_name,credentials=excluded.credentials,expires=excluded.expires,updated=excluded.updated',[expectedEmail(),calendar.id,calendar.name,seal(token),now()+token.expires_in,now()]);
 });
}
type Connection={calendar_id:string;credentials:string;expires:number};
async function connection():Promise<{calendarId:string;accessToken:string}>{
 if(!outlookConfigured())fail('La réservation en ligne est momentanément indisponible. Contactez FrancoRoute.',503);
 // Serialise refresh-token rotation across server instances.
 return transaction(async q=>{
  const [c]=await q('SELECT * FROM outlook_connection WHERE id=1 FOR UPDATE') as Connection[];
  if(!c)fail('Le calendrier doit être connecté par FrancoRoute.',503);
  let token=unseal(c.credentials);
  if(c.expires<now()+120){
   const fresh=await tokens({grant_type:'refresh_token',refresh_token:token.refresh_token});
   token={...fresh,refresh_token:fresh.refresh_token||token.refresh_token};
   await q('UPDATE outlook_connection SET credentials=$1,expires=$2,updated=$3 WHERE id=1',[seal(token),now()+fresh.expires_in,now()]);
  }
  return {calendarId:c.calendar_id,accessToken:token.access_token};
 });
}
export type Busy={starts:number;ends:number;id?:string};
function graphTime(value:{dateTime:string;timeZone:string}){
 if(!value?.dateTime)throw new Error('Invalid Outlook date');
 const text=value.dateTime;
 const utc=/(Z|[+-]\d\d:\d\d)$/.test(text)?text:text+'Z';
 if(!/(Z|[+-]\d\d:\d\d)$/.test(text)&&value.timeZone!=='UTC')throw new Error('Unexpected Outlook timezone');
 const result=Date.parse(utc)/1000;if(!Number.isFinite(result))throw new Error('Invalid Outlook date');return result;
}
export async function outlookBusy(starts:number,ends:number):Promise<Busy[]>{
 const c=await connection(), range=new URLSearchParams({startDateTime:new Date(starts*1000).toISOString(),endDateTime:new Date(ends*1000).toISOString(),'$select':'id,start,end,showAs,isCancelled','$top':'1000'});
 let path='/me/calendars/'+encodeURIComponent(c.calendarId)+'/calendarView?'+range;
 const busy:Busy[]=[];let pages=0;
 while(path){
  if(++pages>30)fail('Le calendrier ne peut pas être vérifié pour le moment.',503);
  const data=await graphWithToken(c.accessToken,path);
  if(!Array.isArray(data.value))throw new Error('Invalid Outlook response');
  for(const event of data.value)if(!event.isCancelled&&event.showAs!=='free')busy.push({starts:graphTime(event.start),ends:graphTime(event.end),id:event.id});
  const next=data['@odata.nextLink'];path='';
  if(next){const u=new URL(next);if(u.origin!=='https://graph.microsoft.com'||!u.pathname.startsWith('/v1.0/me/'))throw new Error('Invalid Graph continuation');path=u.pathname.slice('/v1.0'.length)+u.search;}
 }
 return busy;
}
export async function createOutlookEvent(row:{id:string;source_kind:string;name:string;client_email:string;phone:string;topic:string;starts:number;ends:number}){
 const c=await connection();
 // No attendees: appointments are saved in the school's calendar without sending invitations.
 const data=await graphWithToken(c.accessToken,'/me/calendars/'+encodeURIComponent(c.calendarId)+'/events',{method:'POST',body:JSON.stringify({transactionId:row.id,subject:'FrancoRoute — '+(row.source_kind==='call'?'Premier appel':'Pratique')+' · '+row.name,start:{dateTime:new Date(row.starts*1000).toISOString(),timeZone:'UTC'},end:{dateTime:new Date(row.ends*1000).toISOString(),timeZone:'UTC'},showAs:'busy',isReminderOn:true,reminderMinutesBeforeStart:15,body:{contentType:'text',content:['Réservation FrancoRoute',row.topic,'Nom : '+row.name,'Courriel : '+row.client_email,'Téléphone : '+row.phone,'Heure de l’Est · Référence : '+row.id,'Pour modifier ou annuler : '+cfg().SITE_ORIGIN+'/gestion'].join('\n')}})});
 if(!data?.id)throw new Error('Unconfirmed Outlook event');return data.id as string;
}
export async function deleteOutlookEvent(id:string){const c=await connection();await graphWithToken(c.accessToken,'/me/calendars/'+encodeURIComponent(c.calendarId)+'/events/'+encodeURIComponent(id),{method:'DELETE'});}
