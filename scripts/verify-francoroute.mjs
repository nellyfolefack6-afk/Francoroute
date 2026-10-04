import {build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
// PostgreSQL runs locally in WASM. External auth/mail/payment providers are simulated.
// No customer account is created, no email is sent and no payment is charged.
const sql = new PGlite();
await sql.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
await sql.exec(await readFile('supabase/schema.sql','utf8'));
globalThis.testPg = sql;
globalThis.testUser = null;
globalThis.testCookies = [];
globalThis.authCalls = [];
Object.assign(process.env, {
 DATABASE_URL:'postgresql://local:local@localhost/postgres', SUPABASE_URL:'https://auth.example.test',
 SUPABASE_PUBLISHABLE_KEY:'public-key-fixture', ADMIN_EMAILS:'owner@example.test', SITE_ORIGIN:'https://site.example.test',
 STRIPE_SECRET_KEY:'', STRIPE_WEBHOOK_SECRET:'', PAYMENT_TAX_MODE:'', RESEND_API_KEY:'', BOOKING_MAIL_FROM:'',
 BOOKING_NOTIFY_EMAIL:'francoroute@outlook.com'
});
await mkdir('.checks',{recursive:true});
const stubs = {
 'server-only':'export {};',
 'next/headers':`export const cookies=async()=>({getAll:()=>globalThis.testCookies,set:(name,value,options)=>globalThis.testCookies.push({name,value,options})});`,
 '@supabase/ssr':`export function createServerClient(url,key,options){return {auth:{
 getUser:async()=>({data:{user:globalThis.testUser},error:null}),
 signInWithOtp:async args=>{globalThis.authCalls.push(args);return {error:null}},
 verifyOtp:async args=>{globalThis.authCalls.push(args);const ok=args.token==='123456';if(ok)options.cookies.setAll([{name:'auth-cookie',value:'fixture',options:{httpOnly:true}}]);return {data:{user:ok?{email_confirmed_at:'2026-01-01'}:null},error:ok?null:new Error('invalid')}},
 signOut:async args=>{globalThis.authCalls.push(args);return {error:null}}
 }}}`,
 'pg':`export const types={setTypeParser(){}};export class Pool{on(){} async query(q,p=[]){const r=await globalThis.testPg.query(q,p);return {rows:r.rows,rowCount:r.affectedRows}} async connect(){return {query:this.query.bind(this),release(){}}}}`,
};
const plugin={name:'local-test-services',setup(b){b.onResolve({filter:/^(server-only|next\/headers|@supabase\/ssr|pg)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path]}));}};
await build({entryPoints:['app/api/[action]/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.checks/api.mjs',plugins:[plugin]});
const api=await import('../.checks/api.mjs');
async function call(action,data,method=data===undefined?'GET':'POST',origin='https://site.example.test'){
 const r=new Request('https://site.example.test/api/'+action,{method,headers:{origin,'content-type':'application/json','x-nf-client-connection-ip':'local-fixture','oai-authenticated-user-email':'owner@example.test'},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const res=await api[method](r,{params:Promise.resolve({action})});return {status:res.status,data:await res.json()};
}
const owner={id:'owner',email:'owner@example.test',email_confirmed_at:'2026-01-01'};
const buyer={id:'buyer1',email:'buyer@example.test',email_confirmed_at:'2026-01-01'};
assert.equal((await call('admin')).status,401,'Forged identity header must not authorize');
assert.equal((await call('progress')).status,401);
assert.equal((await call('config')).data.paymentReady,false);
globalThis.testUser={...owner,email_confirmed_at:null};assert.equal((await call('admin')).status,401);
globalThis.testUser=buyer;assert.equal((await call('admin')).status,403);assert.equal((await call('progress')).status,402);
assert.equal((await call('checkout',{accepted:true})).status,503);
assert.equal((await call('auth-code',{email:'invalid'})).status,400);
assert.equal((await call('auth-code',{email:'person@example.test'})).status,200);
assert.equal((await call('auth-verify',{email:'person@example.test',code:'999999'})).status,400);
assert.equal((await call('auth-verify',{email:'person@example.test',code:'123456'})).status,200);
assert.equal(globalThis.testCookies.length,1);
assert.equal((await call('auth-code',{email:'person@example.test'},'POST','https://evil.example.test')).status,403);
// Netlify may use an internal URL, while the browser sends our public origin.
async function proxyAuth(origin, extra={}){
 const r=new Request('http://localhost:3000/api/auth-code',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{}),...extra},body:JSON.stringify({email:'invalid'})});
 return (await api.POST(r,{params:Promise.resolve({action:'auth-code'})})).status;
}
assert.equal(await proxyAuth('https://site.example.test'),400,'Allowed public origin reaches input validation behind the proxy');
for(const origin of ['https://evil.example.test','https://site.example.test.evil.test','http://site.example.test','null',undefined]){
 assert.equal(await proxyAuth(origin,{host:'site.example.test','x-forwarded-host':'site.example.test','x-forwarded-proto':'https'}),403,'Untrusted origin stays blocked even with spoofed headers');
}
process.env.SITE_ORIGIN='https://site.example.test/';
assert.equal(await proxyAuth('https://site.example.test'),400);
process.env.SITE_ORIGIN='https://site.example.test';
Object.assign(process.env,{NETLIFY:'true',CONTEXT:'deploy-preview',DEPLOY_PRIME_URL:'https://deploy-preview-3--example.netlify.app'});
assert.equal(await proxyAuth('https://deploy-preview-3--example.netlify.app'),400);
assert.equal(await proxyAuth('https://site.example.test'),403);
delete process.env.NETLIFY;delete process.env.CONTEXT;delete process.env.DEPLOY_PRIME_URL;
assert.equal((await call('auth-signout',{})).status,200);
globalThis.testUser=owner;
const start=Math.ceil((Date.now()/1000+90000)/900)*900;
assert.equal((await call('admin',{action:'add',starts:[start,start+900]})).status,200);
const slot=(await call('slots')).data.slots[0];
globalThis.testUser=null;
const fields={slotId:slot.id,name:'Client fixture',email:'person@example.test',phone:'226 555 0100',topic:'BDE',consent:true};
assert.equal((await call('bookings',{...fields,consent:false})).status,400);
const bookings=await Promise.all([call('bookings',fields),call('bookings',fields)]);
assert.deepEqual(bookings.map(b=>b.status).sort(),[201,409]);
const booked=bookings.find(b=>b.status===201);
assert.equal((await call('slots')).data.slots.length,1);
assert.equal((await call('cancel',{id:booked.data.id,token:'incorrect'})).status,404);
assert.equal((await call('cancel',{id:booked.data.id,token:booked.data.token})).status,200);
assert.equal((await call('slots')).data.slots.length,2);
globalThis.testUser=owner;
assert.equal((await call('admin',{action:'close',id:slot.id})).status,200);
assert.equal((await call('slots')).data.slots.length,1);
assert.equal((await call('admin',{action:'add',starts:[start]})).status,200);
Object.assign(process.env,{RESEND_API_KEY:'fixture-key',BOOKING_MAIL_FROM:'FrancoRoute <mail@example.test>'});
const realFetch=globalThis.fetch;let attempts=0;
globalThis.fetch=async(url,options)=>{attempts++;assert.equal(url,'https://api.resend.com/emails');const mail=JSON.parse(options.body);assert.deepEqual(mail.to,['francoroute@outlook.com']);assert.ok(mail.text.includes(fields.phone));return Response.json({}, {status:500})};
globalThis.testUser=null;
const mailBooking=await call('bookings',{...fields,email:'notify@example.test'});
assert.equal(mailBooking.status,201);
assert.equal((await sql.query('SELECT notification_status FROM bookings WHERE id=$1',[mailBooking.data.id])).rows[0].notification_status,'failed');
assert.equal((await call('admin',{action:'notify',id:mailBooking.data.id})).status,401);
globalThis.testUser=owner;
globalThis.fetch=async(url,options)=>{attempts++;assert.equal(options.headers['Idempotency-Key'],'francoroute-booking-'+mailBooking.data.id);return Response.json({id:'mail-fixture'})};
assert.equal((await call('admin',{action:'notify',id:mailBooking.data.id})).data.notification,'sent');
assert.equal((await call('admin',{action:'notify',id:mailBooking.data.id})).data.notification,'sent');
assert.equal(attempts,2);
globalThis.fetch=realFetch;
await sql.query("INSERT INTO purchases(id,user_id,starts,expires,status) VALUES('purchase','buyer1',0,$1,'paid')",[Math.floor(Date.now()/1000)+1000]);
globalThis.testUser=buyer;
assert.equal((await call('progress',{version:4,answers:{question1:true},history:[]},'PUT')).status,200);
assert.equal((await call('progress')).data.data.answers.question1,true);
globalThis.testUser={...buyer,id:'buyer2'};assert.equal((await call('progress')).status,402);
Object.assign(process.env,{STRIPE_SECRET_KEY:'fixture',STRIPE_WEBHOOK_SECRET:'fixture-webhook',PAYMENT_TAX_MODE:'exclusive'});
const session={id:'cs_test_fixture',client_reference_id:'buyer2',payment_intent:'pi_fixture',mode:'payment',payment_status:'paid',currency:'cad',amount_subtotal:2800,metadata:{product:'francoroute-21days',access_days:'21'}};
globalThis.fetch=async()=>Response.json(session);
const paidRequest=new Request('https://site.example.test/api/checkout?session_id=cs_test_fixture');
const paidResult=await api.GET(paidRequest,{params:Promise.resolve({action:'checkout'})});assert.equal(paidResult.status,200);
const purchase=(await sql.query("SELECT * FROM purchases WHERE id='cs_test_fixture'")).rows[0];
assert.equal(Number(purchase.expires)-Number(purchase.starts),21*86400);
await api.GET(paidRequest,{params:Promise.resolve({action:'checkout'})});
assert.equal(Number((await sql.query("SELECT COUNT(*) AS count FROM purchases WHERE id='cs_test_fixture'")).rows[0].count),1);
globalThis.testUser=buyer;assert.equal((await api.GET(paidRequest,{params:Promise.resolve({action:'checkout'})})).status,403);
const forged=new Request('https://site.example.test/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':'t=0,v1=invalid'},body:'{}'});
assert.equal((await api.POST(forged,{params:Promise.resolve({action:'stripe-webhook'})})).status,400);
// Authenticated Stripe refund webhook removes access.
const timestamp=Math.floor(Date.now()/1000);const raw=JSON.stringify({type:'charge.refunded',data:{object:{refunded:true,payment_intent:'pi_fixture'}}});
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('fixture-webhook'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw))).toString('hex');
const refunded=new Request('https://site.example.test/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${sig}`},body:raw});
assert.equal((await api.POST(refunded,{params:Promise.resolve({action:'stripe-webhook'})})).status,200);
globalThis.testUser={...buyer,id:'buyer2'};assert.equal((await call('progress')).status,402);
globalThis.fetch=realFetch;
// All public/authenticated direct database roles are denied customer rows.
await sql.exec('SET ROLE anon');
await assert.rejects(sql.query('SELECT * FROM public.bookings'),/permission denied/);
await sql.exec('RESET ROLE');
await build({entryPoints:['lib/client.ts'],bundle:true,platform:'node',format:'esm',outfile:'.checks/client.mjs'});
const {torontoInstant,dayKey}=await import('../.checks/client.mjs');
assert.equal(new Date(torontoInstant('2026-10-05','09:00')*1000).toISOString(),'2026-10-05T13:00:00.000Z');
assert.equal(new Date(torontoInstant('2026-12-05','09:00')*1000).toISOString(),'2026-12-05T14:00:00.000Z');
assert.equal(dayKey(torontoInstant('2026-12-05','09:00')),'2026-12-05');
assert.throws(()=>torontoInstant('2027-03-14','02:30'));
const app=await readFile('private/application.html','utf8');assert.ok(!app.includes('localStorage'));assert.ok(app.includes("fetch('/api/progress'"));
await sql.close();
console.log('PASS: PostgreSQL schema/queries, booking collision/cancellation, roles and account isolation, email failure/retry, verified auth boundary, OTP, CSRF, 21-day paid access, refund/webhook validation, and Toronto times. External providers were simulated.');
