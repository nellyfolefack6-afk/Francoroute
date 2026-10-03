import {api,json,body,sameOrigin,user,admin,rate,fail,now} from '@/lib/server';
import {practiceOverview,practiceSlots,reservePractice,cancelReservation,syncReservation,adminPractice,grantCredits} from '@/lib/practice';
import {startOutlook} from '@/lib/outlook';
import {db} from '@/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{operation:string}>};
export async function GET(r:Request,c:Context){return api(async()=>{
 const {operation}=await c.params;
 if(operation==='admin'){await admin();return json(await adminPractice());}
 const u=await user();
 if(operation==='account')return json(await practiceOverview(u));
 if(operation==='slots'){const p=new URL(r.url).searchParams;await rate('practice-view:'+u.userId,120,3600);return json(await practiceSlots(u,p.get('date')||'',Number(p.get('minutes'))));}
 fail('Page introuvable.',404);
});}
export async function POST(r:Request,c:Context){return api(async()=>{
 sameOrigin(r);const b=await body(r),{operation}=await c.params;
 if(['connect','credits','settings','admin-retry','admin-cancel'].includes(operation)){
  const u=await admin();
  if(operation==='connect')return json({url:await startOutlook(u.userId)});
  if(operation==='credits')return json(await grantCredits(u,b));
  if(operation==='settings'){
   const opening=Number(b.opening),closing=Number(b.closing);
   if(!Number.isInteger(opening)||!Number.isInteger(closing)||opening<0||opening>=closing||closing>1200||opening%15||closing%15)fail('Les horaires doivent se terminer au plus tard à 20 h.');
   await db().prepare('UPDATE practice_settings SET opening=?,closing=? WHERE id=1').bind(opening,closing).run();return json({saved:true});
  }
  if(typeof b.id!=='string')fail('Réservation introuvable.');
  return json(operation==='admin-cancel'?await cancelReservation(b.id):await syncReservation(b.id));
 }
 const u=await user();await rate('practice-write:'+u.userId,30,3600);
 if(operation==='reserve'){const item=await reservePractice(u,b);return json(item,item?.status==='confirmed'?201:202);}
 if(operation==='cancel'){if(typeof b.id!=='string')fail('Réservation introuvable.');return json(await cancelReservation(b.id,u));}
 if(operation==='retry'){
  const row=await db().prepare("SELECT id FROM calendar_reservations WHERE id=? AND user_id=? AND source_kind='practice'").bind(b.id,u.userId).first();
  if(!row)fail('Réservation introuvable.',404);return json(await syncReservation(row.id));
 }
 fail('Page introuvable.',404);
});}
