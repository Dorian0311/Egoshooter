// Local-only deterministic fixture for playback and actual MediaRecorder export.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Game} from '../shared/game';
import {HighlightRecorder} from '../client/highlights';
import {HighlightPlayer} from '../client/HighlightPlayer';
import {defaultSettings} from '../client/gameSettings';
import '../client/operations.css';
const game=new Game('REPLAYQA',600000,'storm');game.add('review','Prüfung');game.add('target','Kroenen');game.ready('review',true,1000);game.ready('target',true,1000);game.tick(4000);
const human=game.player('review')!,target=game.player('target')!;Object.assign(human,{x:-43,z:8,y:0,yaw:0,pitch:-.02,protectedUntil:0});Object.assign(target,{x:-43,z:4.5,y:0,yaw:Math.PI,uniform:'kroenen',protectedUntil:0});
const recorder=new HighlightRecorder();
for(let frame=0;frame<=200;frame++){game.tick(4000+frame*50);if(frame===120)game.operation.damage(target,human.id,0,130,'head',[target.x,1.64,target.z]);recorder.push(game.state,human.id);game.state.events=[];}
const clip=recorder.clips[0];createRoot(document.getElementById('root')!).render(<HighlightPlayer clip={clip} settings={defaultSettings} onClose={()=>location.reload()}/>);
