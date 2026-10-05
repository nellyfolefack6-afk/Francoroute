import 'server-only';
import {db} from '@/db';
const settings=()=>process.env as Record<string,string>;
const timestamp=()=>Math.floor(Date.now()/1000);
export const notificationRecipient=()=>settings().BOOKING_NOTIFY_EMAIL||'francoroute@outlook.com';
export function bookingMailReady(){const c=settings();return Boolean(c.RESEND_API_KEY&&c.BOOKING_MAIL_FROM&&/^https:\/\//.test(c.SITE_ORIGIN||'')&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationRecipient()));}
type BookingMail={id:string;name:string;email:string;phone:string;topic:string;starts:number;notification_status:string};
export async function sendContactMessage({name,email,phone,goal,message}:{name:string;email:string;phone:string;goal:string;message:string}):Promise<boolean>{
 if(!bookingMailReady())return false;
 const c=settings();
 const text=['Nouveau message du formulaire de contact FrancoRoute.','','Nom : '+name,'Courriel : '+email,'Téléphone : '+phone,'Objectif : '+goal,'','Message :',message].join('\n');
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(7000),headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:c.BOOKING_MAIL_FROM,to:[notificationRecipient()],reply_to:email,subject:'FrancoRoute — Message de contact · '+name,text})});
  const result=await response.json() as {id?:string};
  return response.ok&&!!result.id;
 }catch{return false}
}
export async function notifyBooking(id:string):Promise<'sent'|'failed'|'not_configured'|'pending'|'cancelled'>{
 if(!bookingMailReady())return 'not_configured';
 const row=await db().prepare("SELECT b.id,b.name,b.email,b.phone,b.topic,b.notification_status,s.starts FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE b.id=? AND b.status='confirmed'").bind(id).first<BookingMail>();
 if(!row)return 'cancelled';
 if(row.notification_status==='sent')return 'sent';
 const t=timestamp();
 const claimed=await db().prepare("UPDATE bookings SET notification_status='sending',notification_attempted=? WHERE id=? AND status='confirmed' AND notification_status<>'sent' AND (notification_status<>'sending' OR notification_attempted<?) RETURNING id").bind(t,id,t-60).first();
 if(!claimed)return 'pending';
 const when=new Intl.DateTimeFormat('fr-CA',{dateStyle:'full',timeStyle:'short',timeZone:'America/Toronto'}).format(new Date(row.starts*1000));
 const c=settings();
 const text=['Un premier appel vient d’être réservé sur FrancoRoute.','','Date : '+when+' (heure de Toronto)','Durée : 15 minutes','Nom : '+row.name,'Téléphone à appeler : '+row.phone,'Courriel : '+row.email,'Objectif : '+row.topic,'','Rappelez cette personne au numéro indiqué à l’heure du rendez-vous.','Consultez votre agenda avant l’appel pour vérifier une éventuelle annulation :',c.SITE_ORIGIN.replace(/\/$/,'')+'/gestion','','Référence : '+id].join('\n');
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(7000),headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'francoroute-booking-'+id},body:JSON.stringify({from:c.BOOKING_MAIL_FROM,to:[notificationRecipient()],reply_to:row.email,subject:'FrancoRoute — Premier appel · '+when,text})});
  const result=await response.json() as {id?:string};
  if(!response.ok||!result.id)throw new Error('provider_rejected');
  await db().prepare("UPDATE bookings SET notification_status='sent',notification_error=NULL,notification_provider_id=? WHERE id=?").bind(result.id,id).run();
  return 'sent';
 }catch{
  await db().prepare("UPDATE bookings SET notification_status='failed',notification_error='send_unconfirmed' WHERE id=? AND notification_status<>'sent'").bind(id).run();
  return 'failed';
 }
}
