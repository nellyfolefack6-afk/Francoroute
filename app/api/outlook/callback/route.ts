import {admin,cfg} from '@/lib/server';
import {finishOutlook} from '@/lib/outlook';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(r:Request){
 let result='error';
 try{const u=await admin();await finishOutlook(new URL(r.url),u.userId);result='connected';}catch{/* Never log OAuth codes or provider responses. */}
 const target=new URL('/gestion',cfg().SITE_ORIGIN||new URL(r.url).origin);target.searchParams.set('outlook',result);
 return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
