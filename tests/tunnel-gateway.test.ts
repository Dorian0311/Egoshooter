import assert from 'node:assert/strict';
import {test} from 'node:test';
import http from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocket,WebSocketServer} from 'ws';
import {createTunnelGateway} from '../server/tunnelGateway.ts';
import {brotliCompressSync,brotliDecompressSync} from 'node:zlib';

test('tunnel serves built files, protects source, and forwards cookies and WebSockets',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'shooter-tunnel-test-'));
 await writeFile(join(directory,'index.html'),'<h1>Built game</h1>');
 const asset='console.log("compressed game");';
 await writeFile(join(directory,'client.js'),asset);await writeFile(join(directory,'client.js.br'),brotliCompressSync(asset));
 const upstream=http.createServer((req,res)=>{
  res.setHeader('Set-Cookie','session=example; HttpOnly; Secure; SameSite=Lax');
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({path:req.url,cookie:req.headers.cookie,origin:req.headers.origin}));
 });
 const wsServer=new WebSocketServer({server:upstream});
 wsServer.on('connection',(socket,req)=>socket.on('message',message=>socket.send(req.url+':'+message.toString())));
 await new Promise<void>(done=>upstream.listen(0,'127.0.0.1',done));
 const backendPort=(upstream.address() as {port:number}).port;
 const origin='https://test-only.trycloudflare.com';
 const gateway=createTunnelGateway({staticDirectory:directory,backendPort,publicOrigin:origin});
 await new Promise<void>(done=>gateway.server.listen(0,'127.0.0.1',done));
 const base=`http://127.0.0.1:${(gateway.server.address() as {port:number}).port}`;
 let socket:WebSocket|undefined;
 try{
  assert.match(await (await fetch(base)).text(),/Built game/);
  const compressed=await new Promise<{body:Buffer;headers:http.IncomingHttpHeaders}>((done,reject)=>{
   http.get(base+'/client.js',{headers:{'Accept-Encoding':'br'}},response=>{
    const parts:Buffer[]=[];response.on('data',part=>parts.push(part));response.on('end',()=>done({body:Buffer.concat(parts),headers:response.headers}));response.on('error',reject);
   }).on('error',reject);
  });
  assert.equal(compressed.headers['content-encoding'],'br');assert.match(String(compressed.headers['content-type']),/javascript/);
  assert.match(String(compressed.headers.vary),/Accept-Encoding/);assert.equal(brotliDecompressSync(compressed.body).toString(),asset);
  const uncompressed=await fetch(base+'/client.js',{headers:{'Accept-Encoding':'br;q=0, gzip;q=0'}});
  assert.equal(uncompressed.headers.get('content-encoding'),null);assert.equal(await uncompressed.text(),asset);
  const response=await fetch(base+'/game/account/me?check=1',{headers:{Origin:origin,Cookie:'session=example'}});
  assert.equal(response.status,200);
  assert.match(response.headers.get('set-cookie')!,/HttpOnly; Secure/);
  assert.deepEqual(await response.json(),{path:'/account/me?check=1',cookie:'session=example',origin});
  for(const path of ['/.git/config','/server/auth.ts','/data/users.sqlite','/api/shooter/ticket'])assert.ok([403,404].includes((await fetch(base+path)).status));
  assert.equal((await fetch(base+'/game/account/me',{headers:{Origin:'https://untrusted.example'}})).status,403);
  const badHostStatus=await new Promise<number>((done,reject)=>{
   const request=http.get(base,{headers:{Host:'untrusted.example'}},response=>{response.resume();done(response.statusCode!);});request.on('error',reject);
  });
  assert.equal(badHostStatus,403);
  socket=new WebSocket(base.replace('http:','ws:')+'/game/room-id?sessionId=example',{origin});
  const echoed=await new Promise<string>((done,reject)=>{socket!.once('error',reject);socket!.once('open',()=>socket!.send('hello'));socket!.once('message',value=>done(value.toString()));});
  assert.equal(echoed,'/room-id?sessionId=example:hello');
  const denied=new WebSocket(base.replace('http:','ws:')+'/game/room-id',{origin:'https://untrusted.example'});
  denied.on('error',()=>{});
  assert.equal(await new Promise<number>(done=>denied.once('unexpected-response',(_req,res)=>{res.resume();done(res.statusCode!);denied.terminate();})),403);
 }finally{
  socket?.terminate();for(const peer of wsServer.clients)peer.terminate();
  await gateway.close();wsServer.close();
  await new Promise<void>(done=>{upstream.close(()=>done());upstream.closeAllConnections();});
  await rm(directory,{recursive:true,force:true});
 }
});
