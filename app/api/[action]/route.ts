import {authClient,authReady} from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
import {bookingMailReady,notificationRecipient,notifyBooking,sendContactMessage} from '@/lib/booking-mail';
import {api,json,body,sameOrigin,fail,now,hash,rate,admin,user,paid,adminEmail,entitlement,paymentReady,cfg,stripe,fulfill} from '@/lib/server';
import {getFrancoRouteUser} from '@/lib/identity';
import {db} from '@/db';
import {outlookConfigured} from '@/lib/outlook';
import {filterCallSlots,reserveCall,cancelReservation} from '@/lib/practice';
type Ctx={params:Promise<{action:string}>};
export async function GET(r:Request,c:Ctx){return api(async()=>{
 const {action}=await c.params;
 if(action==='config'){const u=await getFrancoRouteUser();return json({paymentReady:paymentReady(),taxMode:cfg().PAYMENT_TAX_MODE||null,signedIn:!!u,admin:u?adminEmail(u.email):false,expires:u?(await entitlement(u.userId))?.expires:null})}
 if(action==='slots'){const {results}=await db().prepare("SELECT s.id,s.starts FROM slots s WHERE s.enabled=1 AND s.starts>? AND s.starts<? AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.slot_id=s.id AND b.status='confirmed') ORDER BY s.starts").bind(now()+7200,now()+180*86400).all();return json({slots:outlookConfigured()?await filterCallSlots(results):results})}
 if(action==='admin'){await admin();const results=await db().batch([db().prepare("SELECT s.id,s.starts,s.enabled,b.id AS booking_id,b.name,b.email,b.phone,b.topic,b.notification_status FROM slots s LEFT JOIN bookings b ON b.slot_id=s.id AND b.status='confirmed' WHERE s.starts>? ORDER BY s.starts").bind(now()-30*86400),db().prepare("SELECT COUNT(*) AS count FROM purchases WHERE status='paid' AND expires>?").bind(now()),db().prepare("SELECT u.email,u.created_at,u.email_confirmed_at,COALESCE(p.expires,0) AS app_expires,COALESCE(cr.minutes,0) AS credit_minutes FROM auth.users u LEFT JOIN LATERAL(SELECT MAX(expires) AS expires FROM purchases WHERE user_id=u.id AND status='paid') p ON true LEFT JOIN LATERAL(SELECT SUM(minutes) AS minutes FROM practice_credits WHERE client_email=u.email AND eligible=true) cr ON true ORDER BY u.created_at DESC LIMIT 300")]);return json({slots:results[0].results,activeAccess:(results[1].results[0] as {count?:number})?.count||0,accounts:results[2].results,paymentReady:paymentReady(),mailReady:bookingMailReady(),notificationEmail:notificationRecipient()})}
 if(action==='progress'){const u=await paid();const p=await db().prepare('SELECT data FROM progress WHERE user_id=?').bind(u.userId).first<{data:string}>();return json({data:p?JSON.parse(p.data):null})}
 if(action==='checkout'){const u=await user();const id=new URL(r.url).searchParams.get('session_id');if(!id||!/^cs_[A-Za-z0-9_]+$/.test(id))fail('Paiement introuvable.');const s=await stripe('checkout/sessions/'+id);if(s.client_reference_id!==u.userId)fail('Paiement associé à un autre compte.',403);await fulfill(s);return json({expires:(await entitlement(u.userId))?.expires||null})}
 fail('Page introuvable.',404);
})}
export async function POST(r:Request,c:Ctx){return api(async()=>{
 const {action}=await c.params;
 if(action==='stripe-webhook'){const secret=cfg().STRIPE_WEBHOOK_SECRET;if(!secret)fail('Service non configuré.',503);const raw=await r.text();if(raw.length>1000000)fail('Message trop volumineux.',413);const parts=(r.headers.get('stripe-signature')||'').split(',');const t=parts.find(v=>v.startsWith('t='))?.slice(2);if(!t||!/^\d+$/.test(t)||Math.abs(now()-Number(t))>300)fail('Signature invalide.');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);let valid=false;for(const sig of parts.filter(v=>v.startsWith('v1=')).map(v=>v.slice(3))){if(!/^[a-f0-9]{64}$/.test(sig))continue;const bytes=new Uint8Array(sig.match(/../g)!.map(v=>parseInt(v,16)));if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(t+'.'+raw)))valid=true}if(!valid)fail('Signature invalide.');const e=JSON.parse(raw);if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(e.type))await fulfill(await stripe('checkout/sessions/'+encodeURIComponent(e.data.object.id)));if(e.type==='charge.refunded'&&e.data.object.refunded&&typeof e.data.object.payment_intent==='string')await db().prepare("UPDATE purchases SET status='refunded' WHERE payment_intent=?").bind(e.data.object.payment_intent).run();return json({received:true})}
 sameOrigin(r);const b=await body(r);
 if(['auth-code','auth-verify','auth-signout'].includes(action)){
  if(!authReady())fail('La connexion est momentanément indisponible.',503);
  const client=await authClient();
  if(action==='auth-signout'){const {error}=await client.auth.signOut({scope:'local'});if(error)fail('La déconnexion a échoué. Réessayez.',503);return json({signedOut:true})}
  const email=String(b.email||'').trim().toLowerCase();
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))fail('Saisissez une adresse courriel valide.');
  const ip=r.headers.get('x-nf-client-connection-ip')||email;
  await rate('auth-ip:'+await hash(ip),30,3600);
  if(action==='auth-code'){
   await rate('auth-send:'+await hash(email),5,3600);
   const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
   if(error)fail('Impossible d’envoyer le code pour le moment. Patientez puis réessayez.',error.status===429?429:503);
   return json({sent:true});
  }
  await rate('auth-verify:'+await hash(email),10,900);
  const token=String(b.code||'').trim();if(!/^\d{6,10}$/.test(token))fail('Vérifiez le code reçu par courriel.');
  const {data,error}=await client.auth.verifyOtp({email,token,type:'email'});
  if(error||!data.user?.email_confirmed_at)fail('Ce code est incorrect ou expiré. Demandez un nouveau code.',400);
  return json({signedIn:true});
 }

 if(action==='contact'){
  const name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),phone=String(b.phone||'').trim(),goal=String(b.goal||'').trim(),message=String(b.message||'').trim();
  if(name.length<2||name.length>100||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||phone.length>25||!/^[+()\d\s.-]{7,25}$/.test(phone)||message.length<5||message.length>2500)fail('Vérifiez vos coordonnées et votre message.');
  await rate('contact-ip:'+await hash(r.headers.get('x-nf-client-connection-ip')||email),10,3600);
  await rate('contact-email:'+await hash(email),5,86400);
  const sent=await sendContactMessage({name,email,phone,goal,message});
  if(!sent)fail('L’envoi est momentanément indisponible. Contactez-nous par téléphone ou courriel.',503);
  return json({sent:true});
 }

 if(action==='bookings'){
 const name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),phone=String(b.phone||'').trim(),topic=String(b.topic||'');
 if(name.length<2||name.length>100||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||!/^[+()\d\s.-]{7,25}$/.test(phone)||!['G1','BDE','G2 / G','Orientation'].includes(topic)||b.consent!==true||typeof b.slotId!=='string')fail('Vérifiez vos coordonnées et votre consentement.');if(b.website)fail('Réservation refusée.');
 await rate('book-ip:'+await hash(r.headers.get('x-nf-client-connection-ip')||email),12,3600);await rate('book-email:'+await hash(email),4,86400);
 const id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
 if(outlookConfigured()){const result=await reserveCall({slotId:b.slotId,name,email,phone,topic},id,await hash(token));try{await notifyBooking(id)}catch{}return json({id,token,starts:result.starts,outlookStatus:result.status},201);}
 try{const result=await db().prepare("INSERT INTO bookings(id,slot_id,name,email,phone,topic,status,cancel_hash,created) SELECT ?,s.id,?,?,?,?,'confirmed',?,? FROM slots s WHERE s.id=? AND s.enabled=1 AND s.starts>? AND s.starts<? AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.slot_id=s.id AND b.status='confirmed') RETURNING slot_id").bind(id,name,email,phone,topic,await hash(token),now(),b.slotId,now()+7200,now()+180*86400).first();if(!result)fail('Ce créneau n’est plus disponible. Choisissez un autre horaire.',409)}catch(e){if((e as {code?:string}).code==='23505')fail('Ce créneau vient d’être réservé.',409);throw e}
 const slot=await db().prepare('SELECT starts FROM slots WHERE id=?').bind(b.slotId).first();try{await notifyBooking(id)}catch{console.error('Booking saved; notification requires attention.')}return json({id,token,starts:slot?.starts},201)
 }
 if(action==='cancel'){if(typeof b.token!=='string'||typeof b.id!=='string')fail('Lien incomplet.');if(outlookConfigured()){const linked=await db().prepare("SELECT b.id FROM bookings b JOIN calendar_reservations r ON r.source_id=b.id AND r.source_kind='call' WHERE b.id=? AND b.cancel_hash=?").bind(b.id,await hash(b.token)).first();if(linked){const outcome=await cancelReservation(linked.id);if(outcome?.status!=='cancelled')fail('L’annulation est en cours de confirmation dans Outlook. Le créneau reste protégé ; réessayez dans un instant.',503);return json({cancelled:true})}}const result=await db().prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND cancel_hash=? AND status='confirmed' RETURNING id").bind(b.id,await hash(b.token)).first();if(!result)fail('Réservation déjà annulée ou lien invalide.',404);return json({cancelled:true})}
 if(action==='admin'){await admin();if(b.action==='notify'&&typeof b.id==='string'){await rate('notify:'+b.id,5,3600);return json({notification:await notifyBooking(b.id)})}if(b.action==='add'){if(!Array.isArray(b.starts)||!b.starts.length||b.starts.length>32||b.starts.some((t:unknown)=>!Number.isInteger(t)||Number(t)<now()+7200||Number(t)>now()+180*86400||Number(t)%900!==0))fail('Choisissez des créneaux de 15 minutes dans les 6 prochains mois, avec un préavis de 2 heures.');await db().batch(b.starts.map((t:number)=>db().prepare('INSERT INTO slots(id,starts,enabled) VALUES(?,?,1) ON CONFLICT(starts) DO UPDATE SET enabled=1').bind(crypto.randomUUID(),t)));return json({saved:true})}
 if(b.action==='close'&&typeof b.id==='string'){const result=await db().prepare("UPDATE slots SET enabled=0 WHERE id=? AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.slot_id=slots.id AND b.status='confirmed') RETURNING id").bind(b.id).first();if(!result)fail('Ce créneau comporte un rendez-vous. Contactez la personne avant de l’annuler.',409);return json({saved:true})}
 if(b.action==='cancel'&&typeof b.id==='string'){if(outlookConfigured()){const linked=await db().prepare("SELECT id FROM calendar_reservations WHERE source_kind='call' AND source_id=?").bind(b.id).first();if(linked){const outcome=await cancelReservation(linked.id);if(outcome?.status!=='cancelled')fail('Annulation en cours dans Outlook. Réessayez depuis les rendez-vous reliés à Outlook.',503);await db().prepare('UPDATE slots SET enabled=0 WHERE id=(SELECT slot_id FROM bookings WHERE id=?)').bind(b.id).run();return json({saved:true});}}await db().batch([db().prepare("UPDATE bookings SET status='cancelled' WHERE id=?").bind(b.id),db().prepare('UPDATE slots SET enabled=0 WHERE id=(SELECT slot_id FROM bookings WHERE id=?)').bind(b.id)]);return json({saved:true})}if(b.action==='grant-app'){const email=String(b.email||'').trim().toLowerCase();const reference=String(b.reference||'').trim();if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||reference.length<3||reference.length>150)fail('Vérifiez le courriel et la référence.');const target=await db().prepare('SELECT id FROM auth.users WHERE email=?').bind(email).first<{id:string}>();if(!target)fail('Ce client doit d’abord se connecter une fois à Mon espace avec ce courriel.',404);const id='app-'+(await hash(reference));const saved=await db().prepare("INSERT INTO purchases(id,user_id,payment_intent,starts,expires,status) VALUES(?,?,?,?,?,'paid') ON CONFLICT(id) DO NOTHING RETURNING id").bind(id,target.id,'manual:'+reference,now(),now()+21*86400).first();if(!saved)fail('Cette référence a déjà été utilisée.',409);return json({saved:true})}fail('Action inconnue.')}
 if(action==='checkout'){const u=await user();if(b.accepted!==true)fail('Acceptez les conditions de l’accès de 21 jours.');if(!paymentReady())fail('Le paiement en ligne n’est pas encore ouvert. Contactez FrancoRoute.',503);if((await entitlement(u.userId))?.expires)fail('Vous disposez déjà d’un accès actif.',409);await rate('checkout:'+u.userId,10,3600);const c=cfg();const p=new URLSearchParams({mode:'payment',locale:'fr','payment_method_types[0]':'card',client_reference_id:u.userId,customer_email:u.email,success_url:c.SITE_ORIGIN+'/espace?session_id={CHECKOUT_SESSION_ID}',cancel_url:c.SITE_ORIGIN+'/application?paiement=annule','line_items[0][price_data][currency]':'cad','line_items[0][price_data][unit_amount]':'2800','line_items[0][price_data][product_data][name]':'FrancoRoute — 3 semaines (21 jours)','line_items[0][price_data][product_data][description]':'Préparation G1, G2 et G Full, et exercices. Paiement unique, sans renouvellement automatique.','line_items[0][quantity]':'1','metadata[product]':'francoroute-21days','metadata[access_days]':'21'});if(c.PAYMENT_TAX_MODE!=='none'){p.set('automatic_tax[enabled]','true');p.set('line_items[0][price_data][tax_behavior]',c.PAYMENT_TAX_MODE)}const s=await stripe('checkout/sessions',p,'checkout-'+u.userId+'-'+Math.floor(Date.now()/1800000));return json({url:s.url})}
 fail('Page introuvable.',404)
})}
export async function PUT(r:Request,c:Ctx){return api(async()=>{if((await c.params).action!=='progress')fail('Page introuvable.',404);sameOrigin(r);const u=await paid();const b=await body(r);if(b?.version!==4||typeof b.answers!=='object'||!Array.isArray(b.history)||b.history.length>100)fail('Progression invalide.');const data=JSON.stringify(b);if(data.length>120000)fail('Vos notes sont trop longues. Veuillez les raccourcir.',413);await db().prepare('INSERT INTO progress(user_id,data,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(u.userId,data,now()).run();return json({saved:true})})}
