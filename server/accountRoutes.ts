import express from 'express';
import type {Request,Response} from 'express';
import {SignJWT} from 'jose';
import {Accounts,AccountError} from './accounts';
const cookieName='eiserne_session';
function cookie(req:Request){return req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);}
export function accountRoutes(accounts:Accounts){
 const router=express.Router(),rates=new Map<string,{at:number;count:number}>();
 router.use(express.json({limit:'2kb'}));router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 const attach=(req:Request,res:Response,user:{id:string;username:string})=>res.cookie(cookieName,accounts.createSession(user),{httpOnly:true,sameSite:'lax',secure:req.secure||process.env.NODE_ENV==='production',path:'/',maxAge:7*86400000});
 for(const action of ['register','login'] as const)router.post('/'+action,async(req,res)=>{
  const key=(req.socket.remoteAddress??'local')+':'+action,now=Date.now();let rate=rates.get(key);
  if(!rate||now-rate.at>60000){rate={at:now,count:0};rates.set(key,rate);}
  if(++rate.count>30){res.status(429).json({error:'Zu viele Versuche. Bitte eine Minute warten.'});return;}
  try{const user=await accounts[action](req.body?.username,req.body?.password);attach(req,res,user);res.status(action==='register'?201:200).json({user});}
  catch(error){res.status(error instanceof AccountError?error.status:500).json({error:error instanceof AccountError?error.message:'Anmeldung gerade nicht verfügbar.'});}
 });
 router.get('/me',(req,res)=>{const user=accounts.session(cookie(req));res.json({user:user??null});});
 router.post('/logout',(req,res)=>{accounts.logout(cookie(req));res.clearCookie(cookieName,{path:'/',httpOnly:true,sameSite:'lax',secure:req.secure||process.env.NODE_ENV==='production'});res.sendStatus(204);});
 router.post('/ticket',async(req,res)=>{
  const user=accounts.session(cookie(req)),secret=process.env.SHOOTER_TICKET_SECRET;
  if(!user){res.status(401).json({error:'Bitte anmelden.'});return;}
  if(!secret||secret.length<32){res.status(503).json({error:'Spielserver ist noch nicht eingerichtet.'});return;}
  const ticket=await new SignJWT({name:user.username,role:'Support.Agent',auth:'local-account'}).setProtectedHeader({alg:'HS256'}).setSubject(user.id).setIssuer('supporthub').setAudience('altstadt-1940').setIssuedAt().setExpirationTime('2m').sign(new TextEncoder().encode(secret));
  const origin=req.headers.origin??`${req.protocol}://${req.get('host')}`;
  res.json({ticket,playerId:user.id,serverUrl:process.env.SHOOTER_PUBLIC_URL??origin+'/game'});
 });
 return router;
}
