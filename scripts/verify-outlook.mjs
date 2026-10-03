import {build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Isolated PostgreSQL and Microsoft Graph fixtures. No live mail, calendar or payments.
const sql=new PGlite();await sql.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
await sql.exec(await readFile('supabase/schema.sql','utf8'));
await sql.exec(await readFile('supabase/outlook-pratique.sql','utf8'));
await sql.exec(await readFile('supabase/outlook-pratique.sql','utf8')); // repeatable migration
globalThis.practicePg=sql;globalThis.practiceUser=null;globalThis.cookieJar=new Map();
let tail=Promise.resolve();
globalThis.acquirePg=async()=>{let release;const prev=tail;tail=new Promise(r=>{release=r});await prev;return release;};
// PGlite has one backend. The mutex models checked-out pg connections; production
// additionally uses a transaction-scoped PostgreSQL advisory lock across instances.
globalThis.queryPg=async(q,p=[])=>{if(q.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:0};const r=await sql.query(q,p);return {rows:r.rows,rowCount:r.affectedRows};};
Object.assign(process.env,{SITE_ORIGIN:'https://site.example.test',DATABASE_URL:'postgresql://fixture:fixture@localhost/test',SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'fixture',ADMIN_EMAILS:'owner@example.test',OUTLOOK_CLIENT_ID:'fixture-client',OUTLOOK_CLIENT_SECRET:'fixture-secret',OUTLOOK_TOKEN_KEY:Buffer.alloc(32,42).toString('base64'),OUTLOOK_ACCOUNT_EMAIL:'francoroute@outlook.com',RESEND_API_KEY:'',BOOKING_MAIL_FROM:''});
const stubs={
 'server-only':'export {};',
 'next/headers':`export const cookies=async()=>({get:name=>globalThis.cookieJar.has(name)?{value:globalThis.cookieJar.get(name)}:undefined,set:(name,value)=>globalThis.cookieJar.set(name,value),delete:name=>globalThis.cookieJar.delete(name),getAll:()=>[],});`,
 '@supabase/ssr':`export const createServerClient=()=>({auth:{getUser:async()=>({data:{user:globalThis.practiceUser},error:null})}});`,
 'pg':`export const types={setTypeParser(){}};export class Pool{on(){} async query(q,p){const release=await globalThis.acquirePg();try{return await globalThis.queryPg(q,p)}finally{release()}}async connect(){const release=await globalThis.acquirePg();return {query:globalThis.queryPg,release}}}`
};
const plugin={name:'fixtures',setup(b){b.onResolve({filter:/^(server-only|next\/headers|@supabase\/ssr|pg)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path]}));}};
await mkdir('.checks',{recursive:true});
await build({entryPoints:['app/api/practice/[operation]/route.ts','app/api/[action]/route.ts','lib/practice.ts','lib/outlook.ts','lib/client.ts'],bundle:true,platform:'node',format:'esm',outdir:'.checks/outlook',outbase:'.',plugins:[plugin]});
const api=await import('../.checks/outlook/app/api/practice/[operation]/route.js');
const oldApi=await import('../.checks/outlook/app/api/[action]/route.js');
const {seal,unseal,startOutlook,finishOutlook,outlookBusy}=await import('../.checks/outlook/lib/outlook.js');
const {validPracticeStart}=await import('../.checks/outlook/lib/practice.js');
const {torontoInstant,dayKey}=await import('../.checks/outlook/lib/client.js');
const t=Math.floor(Date.now()/1000),date=dayKey(t+2*86400),start=torontoInstant(date,'10:00');
const owner={id:'owner',email:'owner@example.test',email_confirmed_at:'2026-01-01'};
const alice={id:'alice',email:'alice@example.test',email_confirmed_at:'2026-01-01'};
const bob={id:'bob',email:'bob@example.test',email_confirmed_at:'2026-01-01'};
let external=[],events=new Map(),posts=0,deletes=0,failPostAfterSave=false,failDelete=false,failRead=false,paginate=false,wrongOwner=false,refreshes=0;
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
 const url=String(input);
 if(url.endsWith('/token')){refreshes++;return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600});}
 assert.ok(url.startsWith('https://graph.microsoft.com/v1.0/me'),'No third-party fetch');
 const p=new URL(url);
 if(p.pathname==='/v1.0/me')return Response.json({mail:wrongOwner?'wrong@example.test':'francoroute@outlook.com'});
 if(p.pathname==='/v1.0/me/calendar')return Response.json({id:'school-calendar',name:'Calendar',canEdit:true});
 if(p.pathname.endsWith('/calendarView')){
  if(failRead)return Response.json({error:'unavailable'},{status:503});
  const from=Date.parse(p.searchParams.get('startDateTime'))/1000,to=Date.parse(p.searchParams.get('endDateTime'))/1000;
  const rows=[...external,...events.values()].filter(e=>Date.parse(e.start.dateTime)/1000<to&&Date.parse(e.end.dateTime)/1000>from);
  if(paginate&&!p.searchParams.has('page'))return Response.json({value:[], '@odata.nextLink':url+'&page=2'});
  return Response.json({value:rows});
 }
 if(p.pathname.endsWith('/events')&&init.method==='POST'){
  posts++;const event=JSON.parse(init.body);assert.equal(event.showAs,'busy');assert.equal(event.attendees,undefined);
  const prior=events.get(event.transactionId);if(prior)return Response.json(prior);
  const saved={...event,id:'event-'+event.transactionId};events.set(event.transactionId,saved);
  if(failPostAfterSave){failPostAfterSave=false;throw new Error('Connection lost after remote save');}
  return Response.json(saved,{status:201});
 }
 if(init.method==='DELETE'){
  deletes++;if(failDelete)return Response.json({error:'unavailable'},{status:503});
  const id=decodeURIComponent(p.pathname.split('/').pop());for(const [key,v] of events)if(v.id===id)events.delete(key);
  return new Response(null,{status:204});
 }
 throw new Error('Unexpected fixture URL');
};
async function call(operation,data,origin='https://site.example.test',module=api){
 const method=data===undefined?'GET':'POST';const req=new Request('https://site.example.test/api/practice/'+operation,{method,headers:{origin,'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const key=module===api?'operation':'action';const res=await module[method](req,{params:Promise.resolve({[key]:operation.split('?')[0]})});return {status:res.status,data:await res.json()};
}
function event(a,b,showAs='busy'){return {id:crypto.randomUUID(),start:{dateTime:new Date(a*1000).toISOString(),timeZone:'UTC'},end:{dateTime:new Date(b*1000).toISOString(),timeZone:'UTC'},showAs};}
assert.equal((await call('account')).status,401);
globalThis.practiceUser=alice;assert.equal((await call('credits',{})).status,403);
assert.equal((await call('reserve',{},'https://other.example.test')).status,403);
const encrypted=seal({secret:'fixture-only'});assert.ok(!encrypted.includes('fixture-only'));assert.deepEqual(unseal(encrypted),{secret:'fixture-only'});assert.throws(()=>unseal(encrypted.slice(0,-4)+'xxxx'));
globalThis.practiceUser=owner;
const authUrl=new URL(await startOutlook(owner.id));assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');assert.equal(authUrl.searchParams.get('redirect_uri'),'https://site.example.test/api/outlook/callback');
await assert.rejects(finishOutlook(new URL('https://site.example.test/api/outlook/callback?state=wrong&code=fixture'),owner.id),/expiré/);
const wrongUrl=new URL(await startOutlook(owner.id));wrongOwner=true;
await assert.rejects(finishOutlook(new URL('https://site.example.test/api/outlook/callback?state='+wrongUrl.searchParams.get('state')+'&code=fixture'),owner.id),/Connectez le compte/);
assert.equal((await sql.query('SELECT * FROM outlook_connection')).rows.length,0);wrongOwner=false;
const goodUrl=new URL(await startOutlook(owner.id));await finishOutlook(new URL('https://site.example.test/api/outlook/callback?state='+goodUrl.searchParams.get('state')+'&code=fixture'),owner.id);
const saved=(await sql.query('SELECT * FROM outlook_connection')).rows[0];assert.equal(saved.account_email,'francoroute@outlook.com');assert.ok(!saved.credentials.includes('fixture-access'));
await assert.rejects(finishOutlook(new URL('https://site.example.test/api/outlook/callback?state='+goodUrl.searchParams.get('state')+'&code=fixture'),owner.id),/expiré/);
const grant={email:alice.email,minutes:180,reference:'PAID-ALICE-1',paid:true,eligible:true};
assert.equal((await call('credits',{...grant,paid:false})).status,400);
assert.equal((await call('credits',grant)).status,200);
assert.equal((await call('credits',grant)).status,409);
assert.equal((await call('credits',{...grant,email:bob.email,reference:'PAID-BOB-1'})).status,200);
assert.equal((await call('settings',{opening:540,closing:1230})).status,400);
assert.equal((await call('settings',{opening:540,closing:1200})).status,200);
// App access must never create driving hours.
globalThis.practiceUser={...alice,id:'appbuyer',email:'apponly@example.test'};
await sql.query("INSERT INTO purchases(id,user_id,starts,expires,status) VALUES('app-only','appbuyer',$1,$2,'paid')",[t,t+86400]);
assert.equal((await call('account')).data.remainingMinutes,0);
const fields={starts:start,minutes:60,name:'Client',phone:'2265550100',consent:true,requestId:crypto.randomUUID()};
assert.equal((await call('reserve',fields)).status,402);
globalThis.practiceUser=alice;
external=[event(start,start+3600)];paginate=true;
assert.equal((await call('reserve',fields)).status,409,'Busy event on second page blocks slot');
paginate=false;external=[];failRead=true;
assert.equal((await call('reserve',fields)).status,503);failRead=false;
// Simultaneous overlapping starts use the same credit/schedule transaction lock.
const two=await Promise.all([call('reserve',fields),call('reserve',{...fields,starts:start+900,requestId:crypto.randomUUID()})]);
assert.deepEqual(two.map(x=>x.status).sort(),[201,409]);
const booked=two.find(x=>x.status===201).data;
assert.equal(events.size,1);assert.equal((await call('account')).data.remainingMinutes,120);
const again=await call('reserve',fields);assert.equal(again.data.id,booked.id);assert.equal(events.size,1);
globalThis.practiceUser=bob;assert.equal((await call('cancel',{id:booked.id})).status,404);
globalThis.practiceUser=alice;
assert.equal((await call('reserve',{...fields,starts:torontoInstant(date,'19:00'),minutes:90,requestId:crypto.randomUUID()})).status,400);
failDelete=true;const cancel=await call('cancel',{id:booked.id});assert.equal(cancel.data.status,'cancel_pending');assert.equal((await call('account')).data.remainingMinutes,120);assert.equal(events.size,1);
failDelete=false;assert.equal((await call('retry',{id:booked.id})).data.status,'cancelled');assert.equal((await call('account')).data.remainingMinutes,180);assert.equal(events.size,0);
assert.equal((await call('cancel',{id:booked.id})).data.status,'cancelled');assert.equal((await call('account')).data.remainingMinutes,180);
failPostAfterSave=true;
const uncertain=await call('reserve',{...fields,requestId:crypto.randomUUID()});assert.equal(uncertain.status,202);assert.equal(uncertain.data.status,'pending');assert.equal(events.size,1);assert.equal((await call('account')).data.remainingMinutes,120);
assert.equal((await call('retry',{id:uncertain.data.id})).data.status,'confirmed');assert.equal(events.size,1,'Idempotent retry must not duplicate event');
assert.equal((await call('cancel',{id:uncertain.data.id})).data.status,'cancelled');
// 15-minute introductory calls and driving sessions share busy ranges.
await sql.query("INSERT INTO slots(id,starts,enabled) VALUES('call-slot',$1,1)",[start]);
globalThis.practiceUser=null;
const firstCall=await call('bookings',{slotId:'call-slot',name:'Caller',email:'caller@example.test',phone:'2265550100',topic:'BDE',consent:true},'https://site.example.test',oldApi);
assert.equal(firstCall.status,201);assert.equal(firstCall.data.outlookStatus,'confirmed');
globalThis.practiceUser=alice;assert.equal((await call('reserve',{...fields,requestId:crypto.randomUUID()})).status,409);
globalThis.practiceUser=null;
assert.equal((await call('cancel',{id:firstCall.data.id,token:'wrong'},'https://site.example.test',oldApi)).status,404);
assert.equal((await call('cancel',{id:firstCall.data.id,token:firstCall.data.token},'https://site.example.test',oldApi)).data.cancelled,true);
globalThis.practiceUser=alice;
const last=await call('reserve',{...fields,minutes:90,requestId:crypto.randomUUID()});assert.equal(last.status,201);
const second=await call('reserve',{...fields,starts:start+7200,minutes:90,requestId:crypto.randomUUID()});assert.equal(second.status,201);
assert.equal((await call('account')).data.remainingMinutes,0);
assert.equal((await call('reserve',{...fields,starts:start+14400,requestId:crypto.randomUUID()})).status,402);
const slots=await call('slots?date='+date+'&minutes=60');assert.equal(slots.status,402);
// DST and 20:00 boundary, seven days a week, no UTC offset hard-coded.
const limits={opening:540,closing:1200};const fakeNow=torontoInstant('2026-10-31','00:00');
assert.equal(validPracticeStart(torontoInstant('2026-11-01','18:30'),90,limits,fakeNow),true);
assert.equal(validPracticeStart(torontoInstant('2026-11-01','18:45'),90,limits,fakeNow),false);
assert.equal(new Date(torontoInstant('2026-11-01','09:00')*1000).toISOString(),'2026-11-01T14:00:00.000Z');
assert.throws(()=>torontoInstant('2027-03-14','02:30'));
await sql.query('UPDATE outlook_connection SET expires=0');const before=refreshes;await Promise.all([outlookBusy(start,start+3600),outlookBusy(start,start+3600)]);assert.equal(refreshes,before+1,'Only one rotating refresh under contention');
for(const role of ['anon','authenticated']){await sql.exec('SET ROLE '+role);for(const table of ['outlook_connection','outlook_oauth','practice_credits','calendar_reservations'])await assert.rejects(sql.query('SELECT * FROM '+table),/permission denied/);await sql.exec('RESET ROLE');}
globalThis.fetch=realFetch;await sql.close();
console.log('PASS — OAuth/PKCE, account binding, encrypted tokens, isolated credits, idempotency, overlapping booking race, Outlook failure protection, cancellation, shared call/practice calendar, pagination, token refresh, DST, latest end 20:00, private DB roles.');
