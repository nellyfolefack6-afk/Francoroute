import 'server-only';
import {db,transaction} from '@/db';
import {fail,now} from '@/lib/server';
import {dayKey,torontoInstant} from '@/lib/client';
import {outlookBusy,outlookStatus,createOutlookEvent,deleteOutlookEvent,type Busy} from '@/lib/outlook';
import type {FrancoRouteUser} from '@/lib/identity';

export const overlaps=(a:Busy,b:Busy)=>a.starts<b.ends&&a.ends>b.starts;
const active="status<>'cancelled'";
const scheduleLock=async(q:any)=>q('SELECT pg_advisory_xact_lock(74032601)');
export async function settings(){return await db().prepare('SELECT opening,closing FROM practice_settings WHERE id=1').first<{opening:number;closing:number}>()||{opening:540,closing:1200};}
function minuteLabel(value:number){return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
export function validPracticeStart(starts:number,minutes:number,limits:{opening:number;closing:number},time=now()){
 if(!Number.isInteger(starts)||![60,90].includes(minutes)||starts%900!==0||starts<time+7200||starts>time+180*86400)return false;
 const date=dayKey(starts);
 return starts>=torontoInstant(date,minuteLabel(limits.opening)) && starts+minutes*60<=torontoInstant(date,minuteLabel(limits.closing));
}
async function localBusy(starts:number,ends:number):Promise<Busy[]>{
 const {results}=await db().prepare(`SELECT starts,ends FROM calendar_reservations WHERE ${active} AND starts<? AND ends>? UNION ALL SELECT s.starts,s.starts+900 AS ends FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status='confirmed' AND s.starts<? AND s.starts+900>?`).bind(ends,starts,ends,starts).all();return results;
}
async function conflict(q:any,starts:number,ends:number){
 const rows=await q(`SELECT id FROM calendar_reservations WHERE ${active} AND starts<$2 AND ends>$1 UNION ALL SELECT b.id FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status='confirmed' AND s.starts<$2 AND s.starts+900>$1 LIMIT 1`,[starts,ends]);
 if(rows.length)fail('Ce créneau vient d’être réservé. Choisissez un autre horaire.',409);
}
export async function practiceOverview(u:FrancoRouteUser){
 const [credit,spent,appointments,connection,limits]=await Promise.all([
  db().prepare('SELECT COALESCE(SUM(minutes),0) AS minutes FROM practice_credits WHERE client_email=? AND eligible=true').bind(u.email).first<{minutes:number}>(),
  db().prepare(`SELECT COALESCE(SUM(minutes),0) AS minutes FROM calendar_reservations WHERE client_email=? AND source_kind='practice' AND ${active}`).bind(u.email).first<{minutes:number}>(),
  db().prepare('SELECT id,starts,ends,minutes,status,sync_error,topic FROM calendar_reservations WHERE user_id=? AND source_kind=\'practice\' ORDER BY starts DESC LIMIT 100').bind(u.userId).all(),
  outlookStatus(),settings()
 ]);
 const total=Number(credit?.minutes||0),used=Number(spent?.minutes||0);
 return {totalMinutes:total,usedMinutes:used,remainingMinutes:Math.max(0,total-used),appointments:appointments.results,connected:connection.connected,opening:limits.opening,closing:limits.closing};
}
export async function practiceSlots(u:FrancoRouteUser,date:string,minutes:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||![60,90].includes(minutes))fail('Choisissez une date et une durée valides.');
 const start=torontoInstant(date,'00:00');
 if(start<now()-86400||start>now()+180*86400)fail('Choisissez une date dans les six prochains mois.');
 const overview=await practiceOverview(u);
 if(overview.remainingMinutes<minutes)fail('Votre solde ne permet pas cette réservation. Contactez FrancoRoute.',402);
 const next=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10),end=torontoInstant(next,'00:00');
 const busy=[...await outlookBusy(start,end),...await localBusy(start,end)];
 const slots=[];
 for(let m=overview.opening;m+minutes<=overview.closing;m+=15){const t=torontoInstant(date,minuteLabel(m));if(validPracticeStart(t,minutes,overview)&&!busy.some(b=>overlaps({starts:t,ends:t+minutes*60},b)))slots.push({starts:t,ends:t+minutes*60});}
 return {slots};
}
function contact(b:any){
 const name=String(b.name||'').trim(),phone=String(b.phone||'').trim();
 if(name.length<2||name.length>100||!/^[+()\d\s.-]{7,25}$/.test(phone)||b.consent!==true)fail('Vérifiez vos coordonnées et votre consentement.');
 return {name,phone};
}
export async function reservePractice(u:FrancoRouteUser,b:any){
 const {name,phone}=contact(b),starts=Number(b.starts),minutes=Number(b.minutes),requestId=String(b.requestId||'');
 if(!/^[0-9a-f-]{36}$/i.test(requestId)||!validPracticeStart(starts,minutes,await settings()))fail('Choisissez un créneau valide se terminant au plus tard à 20 h, heure de l’Est.');
 const prior=await db().prepare("SELECT id,user_id FROM calendar_reservations WHERE source_kind='practice' AND source_id=?").bind(requestId).first();
 if(prior){if(prior.user_id!==u.userId)fail('Réservation introuvable.',404);return syncReservation(prior.id);}
 const ends=starts+minutes*60;
 if((await outlookBusy(starts,ends)).some(b=>overlaps({starts,ends},b)))fail('Cet horaire est déjà occupé dans le calendrier. Choisissez un autre créneau.',409);
 const id=await transaction(async q=>{
  await scheduleLock(q);
  const [again]=await q("SELECT id,user_id FROM calendar_reservations WHERE source_kind='practice' AND source_id=$1",[requestId]);
  if(again){if(again.user_id!==u.userId)fail('Réservation introuvable.',404);return again.id;}
  await conflict(q,starts,ends);
  const [credit]=await q('SELECT COALESCE(SUM(minutes),0) AS total FROM practice_credits WHERE client_email=$1 AND eligible=true',[u.email]);
  const [spent]=await q(`SELECT COALESCE(SUM(minutes),0) AS total FROM calendar_reservations WHERE client_email=$1 AND source_kind='practice' AND ${active}`,[u.email]);
  if(Number(credit.total)-Number(spent.total)<minutes)fail('Vous n’avez pas assez d’heures disponibles.',402);
  const id=crypto.randomUUID();
  await q("INSERT INTO calendar_reservations(id,source_kind,source_id,user_id,client_email,name,phone,topic,starts,ends,minutes,status,created,updated) VALUES($1,'practice',$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$11)",[id,requestId,u.userId,u.email,name,phone,minutes===90?'Préparation avant examen · 1 h 30':'Leçon de pratique · 1 h',starts,ends,minutes,now()]);
  return id;
 });
 return syncReservation(id);
}
export async function reserveCall(b:{slotId:string;name:string;email:string;phone:string;topic:string},id:string,cancelHash:string){
 const slot=await db().prepare('SELECT starts FROM slots WHERE id=? AND enabled=1').bind(b.slotId).first<{starts:number}>();
 if(!slot||slot.starts<now()+7200||slot.starts>now()+180*86400)fail('Ce créneau n’est plus disponible.',409);
 if((await outlookBusy(slot.starts,slot.starts+900)).some(x=>overlaps(x,{starts:slot.starts,ends:slot.starts+900})))fail('Ce créneau n’est plus disponible.',409);
 await transaction(async q=>{
  await scheduleLock(q);
  const [current]=await q('SELECT starts FROM slots WHERE id=$1 AND enabled=1',[b.slotId]);
  if(!current||current.starts<now()+7200)fail('Ce créneau n’est plus disponible.',409);
  await conflict(q,current.starts,current.starts+900);
  await q("INSERT INTO bookings(id,slot_id,name,email,phone,topic,status,cancel_hash,created) VALUES($1,$2,$3,$4,$5,$6,'confirmed',$7,$8)",[id,b.slotId,b.name,b.email,b.phone,b.topic,cancelHash,now()]);
  await q("INSERT INTO calendar_reservations(id,source_kind,source_id,client_email,name,phone,topic,starts,ends,minutes,status,created,updated) VALUES($1,'call',$1,$2,$3,$4,$5,$6::bigint,$6::bigint+900,15,'pending',$7,$7)",[id,b.email,b.name,b.phone,b.topic,current.starts,now()]);
 });
 return {...await syncReservation(id),starts:slot.starts};
}
export async function filterCallSlots(slots:{id:string;starts:number}[]){
 if(!slots.length)return slots;
 const start=slots[0].starts,end=slots[slots.length-1].starts+900;
 const busy=[...await outlookBusy(start,end),...await localBusy(start,end)];
 return slots.filter(s=>!busy.some(b=>overlaps(b,{starts:s.starts,ends:s.starts+900})));
}
type ReservationSummary={id:string;status:string;starts?:number;minutes?:number;sync_error?:boolean};
export async function syncReservation(id:string):Promise<ReservationSummary>{
 const claim=crypto.randomUUID();
 const row=await db().prepare("UPDATE calendar_reservations SET sync_claim=?,sync_until=? WHERE id=? AND status IN('pending','cancel_pending') AND sync_until<? RETURNING *").bind(claim,now()+60,id,now()).first();
 if(!row){const item=await db().prepare('SELECT id,status FROM calendar_reservations WHERE id=?').bind(id).first<ReservationSummary>();if(!item)fail('Réservation introuvable.',404);return item;}
 try{
  // A request whose answer was lost is retried with the same Graph transactionId.
  // Keep both the slot and credit reserved on any ambiguous provider response.
  const eventId=row.outlook_event_id||await createOutlookEvent(row as any);
  await db().prepare('UPDATE calendar_reservations SET outlook_event_id=? WHERE id=? AND sync_claim=?').bind(eventId,id,claim).run();
  const latest=await db().prepare('SELECT status FROM calendar_reservations WHERE id=?').bind(id).first();
  const cancelling=latest?.status==='cancel_pending';
  if(cancelling)await deleteOutlookEvent(eventId);
  await transaction(async q=>{
   await scheduleLock(q);
   // If cancellation arrived during creation, leave it pending for the next retry.
   await q("UPDATE calendar_reservations SET status=CASE WHEN status='cancel_pending' AND $1 THEN 'cancelled' WHEN status='pending' THEN 'confirmed' ELSE status END,sync_error=false,sync_claim=NULL,sync_until=0,updated=$2 WHERE id=$3 AND sync_claim=$4",[cancelling,now(),id,claim]);
   if(cancelling&&row.source_kind==='call')await q("UPDATE bookings SET status='cancelled' WHERE id=$1",[row.source_id]);
  });
 }catch{
  await db().prepare('UPDATE calendar_reservations SET sync_error=true,sync_claim=NULL,sync_until=0,updated=? WHERE id=? AND sync_claim=?').bind(now(),id,claim).run();
 }
 const result=await db().prepare('SELECT id,status,starts,minutes,sync_error FROM calendar_reservations WHERE id=?').bind(id).first<ReservationSummary>();
 if(!result)fail('Réservation introuvable.',404);return result;
}
export async function cancelReservation(id:string,u?:FrancoRouteUser){
 const row=await db().prepare('SELECT user_id,starts,status FROM calendar_reservations WHERE id=?').bind(id).first();
 if(!row||(u&&row.user_id!==u.userId))fail('Réservation introuvable.',404);
 if(row.status==='cancelled')return {id,status:'cancelled'};
 if(u&&row.starts<=now())fail('Pour un cours passé ou commencé, contactez FrancoRoute.',409);
 await db().prepare("UPDATE calendar_reservations SET status='cancel_pending',updated=? WHERE id=? AND status<>'cancelled'").bind(now(),id).run();
 return syncReservation(id);
}
export async function adminPractice(){
 const [connection,limits,credits,appointments]=await Promise.all([
  outlookStatus(),settings(),
  db().prepare("SELECT c.client_email,SUM(c.minutes) AS minutes, (SELECT COALESCE(SUM(r.minutes),0) FROM calendar_reservations r WHERE r.client_email=c.client_email AND r.source_kind='practice' AND r.status<>'cancelled') AS used FROM practice_credits c WHERE c.eligible=true GROUP BY c.client_email ORDER BY c.client_email").all(),
  db().prepare("SELECT id,source_kind,name,phone,client_email,starts,minutes,status,sync_error FROM calendar_reservations WHERE starts>? OR status IN('pending','cancel_pending') ORDER BY starts LIMIT 250").bind(now()-30*86400).all()
 ]);
 return {connection,limits,credits:credits.results,appointments:appointments.results};
}
export async function grantCredits(u:FrancoRouteUser,b:any){
 const email=String(b.email||'').trim().toLowerCase(),minutes=Number(b.minutes),reference=String(b.reference||'').trim();
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||!Number.isInteger(minutes)||minutes<30||minutes>6000||minutes%30||reference.length<3||reference.length>150||b.eligible!==true||b.paid!==true)fail('Confirmez le paiement reçu, les heures et l’autorisation de commencer la pratique.');
 try{await db().prepare('INSERT INTO practice_credits(id,client_email,minutes,payment_reference,created_by,created,eligible) VALUES(?,?,?,?,?,?,true)').bind(crypto.randomUUID(),email,minutes,reference,u.userId,now()).run();}
 catch(e){if((e as any).code==='23505')fail('Cette référence de paiement a déjà été enregistrée.',409);throw e;}
 return {saved:true};
}
