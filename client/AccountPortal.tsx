import React,{useEffect,useState} from 'react';
import './accounts.css';
import './lobby.css';
const App=React.lazy(()=>import('./App'));
export type LocalAccount={id:string;username:string};

export function AccountPortal(){
 const [user,setUser]=useState<LocalAccount|null>(null),[loading,setLoading]=useState(true),[mode,setMode]=useState<'register'|'login'>('register');
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function session(){
  setLoading(true);setError('');
  try{const response=await fetch('/game/account/me',{credentials:'include'});if(!response.ok)throw Error('Die Anmeldung ist gerade nicht erreichbar.');const data=await response.json();setUser(data.user??null);}
  catch(e){setError(e instanceof Error?e.message:'Verbindung fehlgeschlagen.');}finally{setLoading(false);}
 }
 useEffect(()=>{void session();},[]);
 async function submit(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{const response=await fetch('/game/account/'+mode,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const data=await response.json();if(!response.ok)throw Error(data.error??'Anmeldung fehlgeschlagen.');setPassword('');setUser(data.user);}
  catch(e){setError(e instanceof Error?e.message:'Verbindung fehlgeschlagen.');}finally{setBusy(false);}
 }
 if(user)return <>{error&&<div role="alert" className="account-logout-error">{error}<button onClick={()=>setError('')}>Schließen</button></div>}<React.Suspense fallback={<main className="account-screen"><p role="status">Lobby wird geladen …</p></main>}><App account={user} onLogout={()=>{void fetch('/game/account/logout',{method:'POST',credentials:'include'}).then(response=>{if(!response.ok)throw Error('logout');setUser(null);setPassword('');setError('');}).catch(()=>setError('Abmelden gerade nicht möglich. Bitte erneut versuchen.'));}}/></React.Suspense></>;
 return <main className="account-screen"><div className="account-art"/><section className="account-card">
  <div className="lobby-wordmark"><strong>EISERNE FRONT</strong><span>OPERATION 1945</span><small>DEIN TRUPP. DEIN EINSATZ.</small></div>
  {loading?<p role="status">Profil wird geladen …</p>:<><div className="account-tabs"><button aria-pressed={mode==='register'} onClick={()=>{setMode('register');setError('');}}>Profil anlegen</button><button aria-pressed={mode==='login'} onClick={()=>{setMode('login');setError('');}}>Anmelden</button></div>
  <h1>{mode==='register'?'Bereit für deinen ersten Einsatz?':'Willkommen zurück.'}</h1><p>{mode==='register'?'Lege dein Spielerprofil an. Du brauchst nur einen Benutzernamen und ein Passwort.':'Melde dich mit deinem Spielerprofil an.'}</p>
  <form onSubmit={event=>void submit(event)}><label>Benutzername<input autoFocus autoComplete="username" name="username" minLength={3} maxLength={24} required value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Passwort<input type="password" name="password" autoComplete={mode==='register'?'new-password':'current-password'} minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label><small>Benutzername: 3–24 Zeichen · Passwort: mindestens 8 Zeichen</small><button className="account-submit" disabled={busy}>{busy?'Bitte warten …':mode==='register'?'Profil anlegen & zur Lobby':'Anmelden & zur Lobby'}</button></form></>}
  {error&&<div role="alert" className="account-error">{error}<button onClick={()=>void session()}>Verbindung erneut prüfen</button></div>}
 </section></main>;
}
