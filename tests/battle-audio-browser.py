"""Real Web Audio checks plus an exported audition reel; requires the Vite dev server."""
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

folder = Path('artifacts/audio-overhaul-20261116')
folder.mkdir(parents=True, exist_ok=True)
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True, args=['--autoplay-policy=no-user-gesture-required'])
    page = browser.new_page(viewport={'width': 1100, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5173/tests/audio-review.html', wait_until='networkidle')
    page.click('#start')
    page.wait_for_function("document.querySelector('#status').value==='Audio aktiv'")
    report = page.evaluate('''async()=>{
      const {T}=audioReview;
      const {createBattleAudio}=await import('/client/battleAudio.ts');
      async function render(action,seconds=1.6){
        const raw=new OfflineAudioContext(2,Math.ceil(48000*seconds),48000);
        // Keep the normal playback gate open while the browser renders the actual audio graph offline.
        let sources=0;
        const context=new Proxy(raw,{get(target,key){if(key==='state')return 'running';if(key==='createBufferSource')return ()=>{sources++;return target.createBufferSource();};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
        const camera=new T.PerspectiveCamera(),output=raw.createGain();output.connect(raw.destination);
        const audio=createBattleAudio(()=>context,()=>output,camera);audio.listener();action(audio);
        const data=await raw.startRendering();const rms=[],peaks=[];
        for(let channel=0;channel<2;channel++){let sum=0,peak=0;for(const value of data.getChannelData(channel)){sum+=value*value;peak=Math.max(peak,Math.abs(value));}rms.push(Math.sqrt(sum/data.length));peaks.push(peak);}
        audio.dispose();if(audio.effect('sever',undefined,.5))throw Error('Disposed audio played');
        return {left:rms[0],right:rms[1],rms:Math.max(...rms),peak:Math.max(...peaks),sources};
      }
      const audible={};
      for(const name of Object.keys(audioReview.soundDurations)){audible[name]=await render(audio=>audio.effect(name,undefined,.5));if(audible[name].peak<.00001)throw Error('Silent effect: '+name);}
      const leftPan=await render(audio=>audio.effect('rifle',new T.Vector3(-3,0,-1),.5));
      const rightPan=await render(audio=>audio.effect('rifle',new T.Vector3(3,0,-1),.5));
      if(leftPan.left<leftPan.right*1.2||rightPan.right<rightPan.left*1.2)throw Error('Stereo positioning failed');
      const near=await render(audio=>audio.effect('smg',new T.Vector3(0,0,-3),.5)),far=await render(audio=>audio.effect('smg',new T.Vector3(0,0,-30),.5));
      if(far.rms>=near.rms*.35)throw Error('Distance attenuation failed');
      const clear=await render(audio=>audio.effect('g36',undefined,.5)),muffled=await render(audio=>audio.effect('g36',undefined,.5,1,true));
      if(muffled.rms>=clear.rms*.75)throw Error('Room occlusion failed');
      const cancelled=await render(audio=>{audio.reload(0,1.6,.5);audio.cancelReload();},2);if(cancelled.peak>.00001)throw Error('Cancelled reload still audible');
      const engine={id:'test',point:new T.Vector3(0,0,-1),active:false,muffled:false};
      const idle=await render(audio=>audio.engines([engine],.5)),rev=await render(audio=>audio.engines([{...engine,active:true}],.5));if(rev.rms<idle.rms*1.8)throw Error('Chainsaw rev failed');
      const stopped=await render(audio=>{audio.engines([engine],.5);audio.engines([],0);});if(stopped.peak>.00001)throw Error('Chainsaw did not stop');
      const combat=await render(audio=>{for(let i=0;i<120;i++)audio.effect('g36',new T.Vector3(0,0,-3),.8);});if(combat.peak>1||combat.sources!==64)throw Error('Combat mix/budget failed: '+JSON.stringify(combat));
      const inaudible=await render(audio=>{audio.effect('sever',undefined,0);audio.effect('rifle',new T.Vector3(0,0,-200),.8);});if(inaudible.peak!==0||inaudible.sources!==0)throw Error('Muted/distant sounds allocated sources');
      const cleaned=await render(audio=>{audio.effect('harvest',undefined,.5);audio.reload(0,1.6,.5);audio.engines([engine],.5);audio.clear();},2);if(cleaned.peak>.00001)throw Error('Active nodes survived clear');
      return {context:audioReview.context.state,sampleRate:audioReview.context.sampleRate,rendering:'Native browser OfflineAudioContext',effects:Object.keys(audible).length,audible,leftPan,rightPan,near,far,clear,muffled,cancelled,idle,rev,stopped,combat,inaudible,cleaned};
    }''')
    reel = page.evaluate('''async()=>{
      const rate=44100,names=['rifle','pistol','smg','g36','step-stone','step-wood','step-metal','step-earth','flesh','sever','harvest','body'];
      const duration=names.reduce((sum,name)=>sum+Math.max(.8,audioReview.soundDurations[name]+.4),.2),context=new OfflineAudioContext(1,Math.ceil(rate*duration),rate);let at=.1;
      for(const name of names){const data=audioReview.designSound(name,rate),buffer=context.createBuffer(1,data.length,rate);buffer.getChannelData(0).set(data);const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.48;source.connect(gain).connect(context.destination);source.start(at);at+=Math.max(.8,buffer.duration+.4);}
      const rendered=await context.startRendering(),data=rendered.getChannelData(0),bytes=new Uint8Array(44+data.length*2),view=new DataView(bytes.buffer);
      const text=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,data.length*2,true);for(let i=0;i<data.length;i++)view.setInt16(44+i*2,Math.max(-1,Math.min(1,data[i]))*32767,true);
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
    }''')
    (folder / 'sound-reel.wav').write_bytes(base64.b64decode(reel))
    page.screenshot(path=str(folder / 'soundstudio.png'))
    page.evaluate("audioReview.audio.dispose(); if(audioReview.audio.effect('sever',undefined,.5))throw Error('Disposed audio played');audioReview.context.close();")
    report['errors'] = errors
    (folder / 'browser-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'effects': report['effects'], 'stereoRatio': round(report['leftPan']['left'] / report['leftPan']['right'], 2), 'farVsNear': round(report['far']['rms'] / report['near']['rms'], 3), 'maxCombatPeak': round(report['combat']['peak'], 3), 'voiceBudget': report['combat']['sources'], 'lifecycleChecks': 'passed', 'errors': errors}))
    browser.close()
    assert not errors, errors
