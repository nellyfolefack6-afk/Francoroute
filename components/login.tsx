'use client';
import {useState, type FormEvent} from 'react';
import {Header, Footer} from '@/components/website';
import {request} from '@/lib/client';

export default function Login({ready, next}: {ready: boolean; next: string}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (!sent) {await request('auth-code', {email}); setSent(true);}
      else {await request('auth-verify', {email, code}); window.location.assign(next);}
    } catch (e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  return <><Header/><main id="main" className="container section auth-section">
    <div className="eyebrow">Mon espace FrancoRoute</div>
    <h1>Votre parcours,<br/><em>à votre rythme.</em></h1>
    <p className="lead">Connectez-vous pour retrouver votre préparation G1, G2 et G Full et réserver vos heures de pratique.</p>
    {ready ? <form onSubmit={submit} className="auth-card">
      <h2>{sent ? 'Entrez votre code' : 'Se connecter ou créer mon compte'}</h2>
      <p>{sent ? 'Un code vient de vous être envoyé par courriel. Pensez à vérifier les courriers indésirables.' : 'Recevez un code de connexion dans votre boîte courriel. Aucun mot de passe à mémoriser.'}</p>
      <label htmlFor="login-email">Votre adresse courriel</label>
      <input id="login-email" type="email" autoComplete="email" required maxLength={254} value={email} readOnly={sent} onChange={e => setEmail(e.target.value)}/>
      {sent && <><label htmlFor="login-code">Code reçu par courriel</label><input id="login-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}/></>}
      <p className="error" role="alert">{error}</p>
      <div className="actions"><button className="cta" disabled={busy} type="submit">{busy ? 'Un instant…' : sent ? 'Ouvrir mon espace' : 'Recevoir mon code'}</button>
      {sent && <button type="button" className="text-link" disabled={busy} onClick={() => {setSent(false); setCode(''); setError('');}}>Changer d’adresse ou demander un nouveau code</button>}</div>
      <p className="subtle">En continuant, vous acceptez les <a href="/conditions">conditions d’utilisation</a>. Consultez notre <a href="/confidentialite">politique de confidentialité</a>.</p>
    </form> : <div className="auth-card"><h2>La connexion est momentanément indisponible.</h2><p>Contactez-nous pour préparer votre parcours.</p><a className="cta" href="/reserver">Réserver un premier appel</a></div>}
  </main><Footer/></>;
}
