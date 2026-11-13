import express from 'express';
import http from 'node:http';
import type {Socket} from 'node:net';
import {resolve,relative,extname} from 'node:path';
import {existsSync} from 'node:fs';

/** Only the built client and the game API are reachable through the tunnel. */
export function createTunnelGateway(options:{staticDirectory:string;backendPort:number;publicOrigin:string}){
 const origin=new URL(options.publicOrigin);
 const hosts=new Set([origin.hostname,'127.0.0.1','localhost']);
 const origins=new Set([origin.origin,'http://127.0.0.1:4180','http://localhost:4180']);
 const app=express(),sockets=new Set<Socket>();
 app.disable('x-powered-by');
 app.set('env','production');
 function allowed(req:http.IncomingMessage){
  try{
   const host=new URL('http://'+req.headers.host).hostname;
   return hosts.has(host)&&(!req.headers.origin||origins.has(req.headers.origin));
  }catch{return false;}
 }
 function upstreamOptions(req:http.IncomingMessage){
  return {hostname:'127.0.0.1',port:options.backendPort,method:req.method,
   path:req.url!.replace(/^\/game(?=\/|\?|$)/,'')||'/',
   headers:{...req.headers,host:`127.0.0.1:${options.backendPort}`,
    'x-forwarded-for':req.socket.remoteAddress??'127.0.0.1',
    'x-forwarded-host':origin.host,'x-forwarded-proto':'https'}};
 }
 app.use((req,res,next)=>{
  if(!allowed(req)){res.sendStatus(403);return;}
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  if(!/^\/game(?:\/|\?|$)/.test(req.url)){next();return;}
  const upstream=http.request(upstreamOptions(req),response=>{
   res.writeHead(response.statusCode??502,response.headers);
   response.on('error',()=>res.destroy());response.pipe(res);
  });
  upstream.on('error',()=>{if(!res.headersSent)res.status(502).json({error:'Spielserver ist gerade nicht erreichbar.'});else res.destroy();});
  upstream.setTimeout(30000,()=>upstream.destroy());
  req.on('aborted',()=>upstream.destroy());
  res.on('close',()=>{if(!res.writableFinished)upstream.destroy();});
  req.pipe(upstream);
 });
 const directory=resolve(options.staticDirectory);
 app.use((req,res,next)=>{
  // Only built, compressible static files have pre-generated variants.
  res.vary('Accept-Encoding');
  if(!['GET','HEAD'].includes(req.method)||req.headers.range){next();return;}
  let path:string;try{path=decodeURIComponent(req.path);}catch{res.sendStatus(400);return;}
  if(!/\.(js|css|json|gltf|glb|bin|hdr|svg)$/.test(path)){next();return;}
  const file=resolve(directory,'.'+path),within=relative(directory,file);
  if(within.startsWith('..')||within.includes(':')){res.sendStatus(403);return;}
  const accepted=new Map((req.headers['accept-encoding']??'').split(',').map(value=>{
   const [name,...params]=value.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));
   return [name,q?Number(q.trim().slice(2)):1] as const;
  }));
  for(const [encoding,suffix] of [['br','.br'],['gzip','.gz']] as const){
   if((accepted.get(encoding)??accepted.get('*')??0)>0&&existsSync(file+suffix)){
    res.type(extname(path));res.setHeader('Content-Encoding',encoding);
    req.url=req.url.replace(/\?[^]*$/,'')+suffix;break;
   }
  }
  next();
 });
 app.use(express.static(directory,{dotfiles:'deny',index:'index.html',fallthrough:false,
  setHeaders(res,path){
   res.setHeader('Cache-Control',path.endsWith('.html')?'no-cache':
    relative(directory,path).startsWith('assets')?'public, max-age=31536000, immutable':'public, max-age=86400');
  }}));
 app.use((error:{status?:number},_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  res.sendStatus(error.status===403?403:error.status===404?404:500);
 });
 const server=http.createServer(app);
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
 server.on('upgrade',(req,socket,head)=>{
  if(!allowed(req)||!req.url?.startsWith('/game/')||req.headers.upgrade?.toLowerCase()!=='websocket'){
   socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
  }
  const upstream=http.request(upstreamOptions(req));
  upstream.on('error',()=>socket.destroy());
  socket.on('error',()=>upstream.destroy());
  socket.once('close',()=>upstream.destroy());
  upstream.on('response',response=>{response.resume();socket.end(`HTTP/1.1 ${response.statusCode??502} Connection rejected\r\nConnection: close\r\n\r\n`);});
  upstream.on('upgrade',(response,peer,peerHead)=>{
   const headers=response.rawHeaders.reduce((lines,value,i)=>i%2?lines+value+'\r\n':lines+value+': ','');
   socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n`);
   if(peerHead.length)socket.write(peerHead);
   if(head.length)peer.write(head);
   peer.on('error',()=>socket.destroy());
   peer.once('close',()=>socket.destroy());socket.once('close',()=>peer.destroy());
   socket.pipe(peer);peer.pipe(socket);
  });
  upstream.end();
 });
 return {server,close:()=>{for(const socket of sockets)socket.destroy();return new Promise<void>(done=>server.close(()=>done()));}};
}
