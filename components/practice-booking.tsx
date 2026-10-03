'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {request,dayKey,dateLabel,timeLabel} from '@/lib/client';
const hours=(n:number)=>(n/60).toLocaleString('fr-CA',{maximumFractionDigits:1})+' h';
const status=(s:string)=>({confirmed:'Confirmé',pending:'Confirmation Outlook en cours',cancel_pending:'Annulation en cours',cancelled:'Annulé'}[s]||s);
export default function PracticeBooking(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [date,setDate]=useState(dayKey(Date.now()/1000+86400)),[minutes,setMinutes]=useState(60),[slots,setSlots]=useState<any[]>([]),[selected,setSelected]=useState(0),[loading,setLoading]=useState(false);
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[consent,setConsent]=useState(false),[cancelId,setCancelId]=useState('');
 const requestId=useRef(''), generation=useRef(0);
 const load=useCallback(()=>request('practice/account').then(setData),[]);
 useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
 const lookup=useCallback(async()=>{
  const generationId=++generation.current;setLoading(true);setSlots([]);setSelected(0);setError('');requestId.current='';
  try{const d=await request('practice/slots?date='+encodeURIComponent(date)+'&minutes='+minutes);if(generationId===generation.current)setSlots(d.slots);}
  catch(e){if(generationId===generation.current)setError((e as Error).message);}finally{if(generationId===generation.current)setLoading(false);}
 },[date,minutes]);
 useEffect(()=>{if(data?.connected&&data.remainingMinutes>=minutes)void lookup();else {setSlots([]);setSelected(0);}return()=>{generation.current++;};},[lookup,data?.connected,data?.remainingMinutes,minutes]);
 async function book(e:React.FormEvent){
  e.preventDefault();if(!selected||busy)return;setBusy(true);setError('');setMessage('');
  if(!requestId.current)requestId.current=crypto.randomUUID();
  try{const r=await request('practice/reserve',{requestId:requestId.current,starts:selected,minutes,name,phone,consent});
   setMessage(r.status==='confirmed'?'Votre cours est confirmé et enregistré dans le calendrier FrancoRoute.':'Votre demande est enregistrée. Ce créneau et vos heures restent réservés pendant la confirmation Outlook.');
   requestId.current='';setSelected(0);await load();await lookup();
  }catch(e){setError((e as Error).message);await load().catch(()=>{});}finally{setBusy(false);}
 }
 async function change(action:string,id:string){setBusy(true);setError('');setMessage('');try{const r=await request('practice/'+action,{id});setMessage(r.status==='cancelled'?'Le cours est annulé. Les heures ont été rendues à votre solde.':r.status==='confirmed'?'Le cours est confirmé dans Outlook.':'La synchronisation reste en cours. Votre créneau reste protégé.');setCancelId('');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="practice-area"><div className="eyebrow">Mon espace · Conduite</div><h1>Mes heures de pratique</h1><p className="lead">Choisissez vos cours du lundi au dimanche. Les horaires sont affichés à l’heure de l’Est et les cours se terminent au plus tard à 20 h.</p>
 <p className="error" role="alert">{error}</p><p className="success" role="status">{message}</p>
 {!data?<p>{error?'Votre espace ne peut pas être chargé pour le moment.':'Chargement de vos heures…'} {error&&<button className="text-link" onClick={()=>{setError('');load().catch(e=>setError(e.message));}}>Réessayer</button>}</p>:<>
 <div className="practice-summary"><div><span>Heures payées disponibles à la réservation</span><strong>{hours(data.totalMinutes)}</strong></div><div><span>Heures réservées ou utilisées</span><strong>{hours(data.usedMinutes)}</strong></div><div><span>Heures restantes</span><strong>{hours(data.remainingMinutes)}</strong></div></div>
 <p className="note">Après validation de votre paiement par FrancoRoute, vos heures apparaissent ici. L’accès à l’application G1, G2 et G Full est un achat distinct et ne comprend pas de leçons de conduite.</p>
 {!data.connected?<div className="admin-hint"><p>La réservation en ligne est momentanément indisponible. Contactez <a href="mailto:francoroute@outlook.com">francoroute@outlook.com</a> pour organiser vos cours.</p></div>:data.remainingMinutes<60?<div className="admin-hint"><p>Vous n’avez pas encore assez d’heures disponibles pour réserver. Si vous avez déjà payé, contactez FrancoRoute pour faire valider vos heures et, pour le BDE, vos prérequis.</p></div>:<section className="admin-panel"><h2>Réserver mon prochain cours</h2><div className="form-grid"><label>Date<input type="date" value={date} min={dayKey(Date.now()/1000)} max={dayKey(Date.now()/1000+179*86400)} onChange={e=>setDate(e.target.value)} disabled={busy}/></label><label>Durée<select value={minutes} disabled={busy} onChange={e=>setMinutes(Number(e.target.value))}><option value={60}>Pratique · 1 h</option><option value={90} disabled={data.remainingMinutes<90}>Préparation avant examen · 1 h 30</option></select></label></div>
 <div className="practice-times" aria-label="Heures disponibles">{loading?<p>Vérification du calendrier Outlook…</p>:slots.length===0?<p>Aucun créneau disponible à cette date. Choisissez un autre jour.</p>:slots.map(s=><button type="button" key={s.starts} aria-pressed={selected===s.starts} className={selected===s.starts?'chosen':''} disabled={busy} onClick={()=>{setSelected(s.starts);requestId.current='';}}>{timeLabel(s.starts)} – {timeLabel(s.ends)}</button>)}</div>
 {selected>0&&<form onSubmit={book}><p><strong>{dateLabel(selected)} · {timeLabel(selected)} · {hours(minutes)}</strong></p><div className="form-grid"><label>Nom complet<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label><label>Téléphone<input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"/></label></div><label className="practice-check"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>J’autorise FrancoRoute à utiliser ces coordonnées pour organiser mon cours.</label><button className="cta" disabled={busy}>{busy?'Enregistrement…':'Confirmer mon cours'}</button><p className="note">Cette réservation déduit {hours(minutes)} de votre solde. Aucun paiement supplémentaire n’est effectué ici. La location de voiture et les frais d’examen se réservent séparément.</p></form>}
 </section>}
 <section className="admin-panel"><h2>Mes cours</h2>{data.appointments.length===0?<p>Vos réservations apparaîtront ici.</p>:<ul className="practice-appointments">{data.appointments.map((a:any)=><li key={a.id}><div><strong>{dateLabel(a.starts)} · {timeLabel(a.starts)}</strong><p>{a.topic} · {status(a.status)}</p></div><div className="actions">{['pending','cancel_pending'].includes(a.status)&&<button disabled={busy} className="text-link" onClick={()=>change('retry',a.id)}>Vérifier la confirmation</button>}{['pending','confirmed'].includes(a.status)&&a.starts>Date.now()/1000&&(cancelId===a.id?<><span>Annuler ce cours ?</span><button disabled={busy} className="text-link" onClick={()=>change('cancel',a.id)}>Oui, annuler</button><button className="text-link" onClick={()=>setCancelId('')}>Garder le cours</button></>:<button disabled={busy} className="text-link" onClick={()=>setCancelId(a.id)}>Annuler</button>)}</div></li>)}</ul>}</section>
 </>}
 </div>;
}
