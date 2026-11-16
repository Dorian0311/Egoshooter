// Isolated network fixture: deterministic initial positions/inventory, then ordinary Game inputs only.
import http from 'node:http';
import {Room,Server,type Client} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Game} from '../shared/game';
import {difference} from '../shared/protocol';
class MedicalFixture extends Room{
 game=new Game('MEDNET',600000,'cologne',()=>.5,{kind:'coop',mode:'mission',mission:'sabotage'});
 users=new Map<string,string>();logical=0;initialized=false;baseline:Game['state']|null=null;
 onCreate(){this.maxClients=3;this.onMessage('input',(client,input)=>this.game.input(this.users.get(client.sessionId)??'',input));this.onMessage('interact',(client,value)=>{const id=this.users.get(client.sessionId)??'',before=this.game.interactions.get(id),accepted=this.game.interact(id,value),p=this.game.player(id);client.send('action-result',{value,accepted,now:this.game.state.now,before,heldPart:p?.heldPart,throwAt:p?.throwAt,kind:p?.kind,connected:p?.connected,treatment:p?.treatment??null});});
  this.setSimulationInterval(()=>{this.logical+=1000/30;this.game.tick(this.logical);if(this.game.state.phase==='playing'&&!this.initialized){this.initialized=true;const tent=this.game.state.aidTents.find(t=>t.team==='de')!,a=this.game.player('a')!,b=this.game.player('b')!,c=this.game.player('c')!;Object.assign(a,{x:tent.x+1.2,y:tent.y,z:tent.z+1.5,bandages:1,team:'de',protectedUntil:0});Object.assign(b,{x:tent.x,y:tent.y,z:tent.z+1.5,hp:50,team:'de',yaw:0,protectedUntil:0});Object.assign(c,{x:tent.x,y:tent.y,z:tent.z-2.5,team:'fr',protectedUntil:0});}
   const packet=this.baseline?difference(this.baseline,this.game.state):{full:this.game.state};this.broadcast('snapshot',packet);this.baseline=structuredClone(this.game.state);
  },1000/90);
 }
 onJoin(client:Client,options:{id?:string}){if(!['a','b','c'].includes(options.id??'')||this.game.player(options.id!))throw Error('Invalid fixture identity');const p=this.game.add(options.id!,options.id!);this.users.set(client.sessionId,p.id);if(p.id==='c'){p.kind='bot';p.team='fr';}else p.team='de';client.send('snapshot',{full:this.game.state});if(this.clients.length===3)for(const q of this.game.state.players)this.game.ready(q.id,true,this.logical);}
}
const server=http.createServer(),game=new Server({transport:new WebSocketTransport({server})});game.define('medical-fixture',MedicalFixture);await game.listen(Number(process.env.PORT??2595),'127.0.0.1');console.log('medical fixture ready');
