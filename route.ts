import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {paid,api} from '@/lib/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(){return api(async()=>{await paid();const html=await readFile(join(process.cwd(),'private/application.html'),'utf8');return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"}})})}
