import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Game} from '../shared/game';
import {OperationHud} from '../client/OperationHud';
import {VictimFace,CorpseShield} from '../client/VictimFace';
import '../client/style.css';
import '../client/operations.css';
const game=new Game('HUDQA',600000,'cologne',()=>.5,{kind:'coop',mode:'mission',mission:'documents'});game.add('a','Dorian');game.add('b','Partner');game.operation.configureBots();for(const p of game.state.players)game.ready(p.id,true,0);game.tick(3000);const player=game.player('a')!,partner=game.player('b')!;partner.protectedUntil=0;game.operation.damage(partner,'bot-0',0,100,'head',[partner.x,1.6,partner.z]);
function Review(){const [mode,setMode]=useState('carry'),s=structuredClone(game.state),p=s.players.find(q=>q.id==='a')!,corpse=s.corpses[0];p.hp=70;p.bandages=1;p.heldPart=null;p.carriedCorpse=null;p.corpseShield=0;
 if(mode==='carry'&&corpse){p.carriedCorpse=corpse.id;p.corpseShield=90;corpse.carrierId=p.id;}
 if(mode==='harvest'&&corpse)p.treatment={kind:'harvest',target:corpse.id,targetLife:corpse.sourceLife,started:s.now,until:s.now+3000,x:p.x,z:p.z};
 if(mode==='medical'&&corpse){p.hp=0;corpse.sourceId=p.id;corpse.sourceLife=p.life;corpse.medicalUntil=s.now+8000;}
 if(mode==='part'&&s.bodyParts[0])p.heldPart=s.bodyParts[0].id;
 return <div className="city-app"><OperationHud snapshot={s} player={p} throwKey="G" bandageKey="H"/><VictimFace name="Gegner Kroenen" uniform="kroenen" headshot/>
  <div className="city-hud"><strong>{p.hp}<small>GESUNDHEIT</small></strong>{p.carriedCorpse&&<CorpseShield value={p.corpseShield}/>}</div>
  <nav style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:8,zIndex:20}}>{[['carry','Tragen'],['harvest','Kopf lösen'],['medical','Erste Hilfe'],['part','Körperteil']].map(([value,label])=><button key={value} onClick={()=>setMode(value)}>{label}</button>)}</nav>
 </div>;
}createRoot(document.getElementById('root')!).render(<Review/>);
