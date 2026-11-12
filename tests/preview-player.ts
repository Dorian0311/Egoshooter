// Idle second client for local visual QA; not production bot gameplay.
import {Client} from '@colyseus/sdk';
import {SignJWT} from 'jose';
const secret='local-browser-preview-secret-32-chars-only';
const ticket=await new SignJWT({name:'Bruno',role:'Support.Agent'}).setProtectedHeader({alg:'HS256'}).setIssuer('supporthub').setAudience('altstadt-1940').setSubject('preview-b').setIssuedAt().setExpirationTime('2m').sign(new TextEncoder().encode(secret));
const client=new Client('ws://127.0.0.1:2580',{headers:{Origin:'http://127.0.0.1:5173'}});
let room;
if(process.argv[2]==='create'){room=await client.create('altstadt',{ticket,mapId:process.argv[3]??'cologne'});}else{
 const response=await fetch(`http://127.0.0.1:2580/rooms/${encodeURIComponent(process.argv[2]??'')}`,{headers:{Authorization:`Bearer ${ticket}`}});
 if(!response.ok)throw Error('Preview room not found');const {roomId}=await response.json();room=await client.joinById(roomId,{ticket});
}
let printed=false;room.onMessage('snapshot',(packet)=>{if(packet.full&&!printed){console.log('Preview room:',packet.full.roomCode);printed=true;}});room.send('sync');room.send('ready',true);
console.log('Local QA player connected and ready');
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>void room.leave().then(()=>process.exit()));
