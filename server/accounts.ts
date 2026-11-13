import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomBytes,randomUUID,scrypt,timingSafeEqual,createHash} from 'node:crypto';
export type Account={id:string;username:string};
type Row=Account&{salt:string;password_hash:string};
export class AccountError extends Error{constructor(message:string,public status=400){super(message);}}
const sessionHash=(token:string)=>createHash('sha256').update(token).digest('hex');
let active=0;const waiting:(()=>void)[]=[];
async function derive(password:string,salt:string){
 if(active>=2){if(waiting.length>=16)throw new AccountError('Bitte kurz warten und erneut versuchen.',429);await new Promise<void>(resolve=>waiting.push(resolve));}
 active++;
 try{return await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));}
 finally{active--;waiting.shift()?.();}
}
function credentials(username:unknown,password:unknown){
 if(typeof username!=='string'||typeof password!=='string')throw new AccountError('Benutzername und Passwort erforderlich.');
 const name=username.normalize('NFKC').trim();
 if(!/^[\p{L}\p{N}_.-]{3,24}$/u.test(name))throw new AccountError('Benutzername: 3–24 Buchstaben, Zahlen, Punkt, Strich oder Unterstrich.');
 if(password.length<8||password.length>128)throw new AccountError('Das Passwort muss 8–128 Zeichen lang sein.');
 return {name,key:name.toLocaleLowerCase('de'),password};
}
export class Accounts{
 private db:DatabaseSync;
 constructor(path:string){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  this.db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL,username_key TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);`);
 }
 async register(username:unknown,password:unknown):Promise<Account>{
  const v=credentials(username,password);
  if(this.db.prepare('SELECT id FROM users WHERE username_key=?').get(v.key))throw new AccountError('Dieser Benutzername ist bereits vergeben.',409);
  const salt=randomBytes(16).toString('hex'),hash=await derive(v.password,salt),id=randomUUID();
  try{this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id,v.name,v.key,salt,hash.toString('hex'),Date.now());}
  catch(error){if(String(error).includes('UNIQUE'))throw new AccountError('Dieser Benutzername ist bereits vergeben.',409);throw error;}
  return {id,username:v.name};
 }
 async login(username:unknown,password:unknown):Promise<Account>{
  const v=credentials(username,password),row=this.db.prepare('SELECT id,username,salt,password_hash FROM users WHERE username_key=?').get(v.key) as Row|undefined;
  const hash=await derive(v.password,row?.salt??'93f7b35f781a502bef4493ac293ec6a7');
  if(!row||!timingSafeEqual(hash,Buffer.from(row.password_hash,'hex')))throw new AccountError('Benutzername oder Passwort ist falsch.',401);
  return {id:row.id,username:row.username};
 }
 createSession(user:Account,now=Date.now()){
  const token=randomBytes(32).toString('base64url');
  this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);
  this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sessionHash(token),user.id,now+7*86400000);return token;
 }
 session(token:unknown,now=Date.now()):Account|undefined{
  if(typeof token!=='string'||token.length>128)return undefined;
  const row=this.db.prepare('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(sessionHash(token),now) as Account|undefined;
  return row?{id:row.id,username:row.username}:undefined;
 }
 logout(token:unknown){if(typeof token==='string'&&token.length<=128)this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sessionHash(token));}
 close(){this.db.close();}
}
