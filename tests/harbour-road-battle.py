"""Profile real local battles with keyboard movement and verified 180-degree mouse turns."""
import json
import heapq
import math
import os
import re
import time
from pathlib import Path
from playwright.sync_api import TimeoutError as PlaywrightTimeout, sync_playwright
from harbour_frame_metrics import distribution, moving_frames


PRODUCTION = os.environ.get('BATTLE_PRODUCTION') == '1'
BASE = os.environ.get('BATTLE_BASE_URL', 'http://127.0.0.1:5173')
OUT = Path('artifacts/harbour-battle') / ('production' if PRODUCTION else '')
OUT.mkdir(parents=True, exist_ok=True)
COMBAT_MOVEMENT = os.environ.get('BATTLE_COMBAT_MOVEMENT') == '1'
FIXED_TURNS = os.environ.get('BATTLE_FIXED_TURNS') == '1'
DRAW_PROFILE = os.environ.get('BATTLE_DRAW_PROFILE') == '1'
GPU_PROFILE = os.environ.get('BATTLE_GPU_PROFILE') == '1'
FRAME_PHASES = os.environ.get('BATTLE_FRAME_PHASES') == '1'
assert not DRAW_PROFILE or PRODUCTION, 'BATTLE_DRAW_PROFILE requires the separate production harness'
assert not GPU_PROFILE or PRODUCTION, 'BATTLE_GPU_PROFILE requires the separate production harness'
assert not FRAME_PHASES or PRODUCTION, 'BATTLE_FRAME_PHASES requires the separate production harness'


def observe(route):
    # Add read-only probes to the local Vite response, leaving gameplay and frame scheduling intact.
    response = route.fetch()
    source, count = re.subn(r"(scene\.current\?\.update\(s, (\w+)\.playerId, 'network'\);)",
        r'\1 window.observeHarbourBattle(own,s,scene.current);', response.text())
    assert count == 1, 'Snapshot observation point changed'
    route.fulfill(response=response, body=source)


def write_report(path, report):
    # Publish only complete JSON, even if Chrome or the harness is interrupted.
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(report,indent=2),encoding='utf-8')
    temporary.replace(path)


class TurnLifeInterrupted(AssertionError):
    def __init__(self,detail,position=None):
        super().__init__(detail)
        self.position=position


def verify_life(hp, life, expected, site, position=None):
    if hp<=0 or life!=expected:
        raise TurnLifeInterrupted((site,expected,life,hp),position if hp<=0 else None)


def recover_life(page):
    page.wait_for_function('harbourQA.player.hp>0',timeout=20000)
    if not page.evaluate('!!document.pointerLockElement'):
        activate_controls(page)


def activate_controls(page):
    page.bring_to_front()
    for attempt in range(2):
        page.locator('.city-canvas').click(force=True)
        page.wait_for_timeout(300)
        yaw=page.evaluate('harbourQA.player.yaw')
        mouse(page,28)
        try:
            page.wait_for_function("""before=>{
                const delta=harbourQA.player.yaw-before;
                return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))>.025;
            }""",arg=yaw,timeout=3500)
        except PlaywrightTimeout:
            if attempt==0:
                continue
            focus=page.evaluate("""()=>({
                focused:document.hasFocus(),locked:!!document.pointerLockElement,
                canvasFocused:document.activeElement?.matches('.city-canvas'),
                phase:harbourQA.state.phase,alive:harbourQA.player.hp>0
            })""")
            raise AssertionError(('Game controls did not activate',focus)) from None
        mouse(page,-28)
        page.wait_for_function("""before=>{
            const delta=harbourQA.player.yaw-before;
            return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<.02;
        }""",arg=yaw,timeout=3500)
        return


def walk(page, x, z, *, life=None, settle_ms=220):
    deadline = time.monotonic() + 45
    previous = None
    last_turn = 0
    try:
        while time.monotonic() < deadline:
            px, pz, yaw, hp, current_life = page.evaluate('()=>{const p=harbourQA.player;return [p.x,p.z,p.yaw,p.hp,p.life]}')
            if life is None:
                life=current_life
            verify_life(hp,current_life,life,{'waypoint':[x,z],'observedPosition':[px,pz]},(px,pz))
            distance = math.hypot(px-x, pz-z)
            if distance < .60:
                return
            target = math.atan2(px-x, pz-z)
            # Reconcile after a server snapshot has caught up with our last mouse turn.
            reference = yaw if previous is None or time.monotonic()-last_turn>.36 else previous
            if previous is None or abs(math.remainder(target-reference, math.tau)) > .025:
                delta = math.remainder(target-reference, math.tau)
                mouse(page, -round(delta/.002))
                previous = target
                last_turn = time.monotonic()
            if hp<65:
                page.keyboard.press('h')
            if distance>4:
                page.keyboard.down('Shift')
            else:
                page.keyboard.up('Shift')
            page.keyboard.down('w')
            page.wait_for_timeout(60)
        raise AssertionError(('Waypoint blocked', x, z, px, pz))
    finally:
        page.keyboard.up('Shift')
        page.keyboard.up('w')
        page.wait_for_timeout(settle_ms)


def mouse(page, dx):
    page.evaluate("dx=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,bubbles:true}))", dx)


def measure(page, name):
    if not COMBAT_MOVEMENT:
        return measure_turns(page,name)
    page.evaluate("""()=>{const {life,x,z}=harbourQA.player;
        window.combatMotionProbe={life,x,z,distance:0,shots:0,botShots:0,hits:0,glass:0,seen:new Set(harbourQA.state.events.map(e=>e.eventId))};}""")
    try:
        page.keyboard.down('d')
        result=measure_turns(page,name)
        activity=page.evaluate('()=>{const {distance,shots,botShots,hits,glass}=combatMotionProbe;return {distance,shots,botShots,hits,glass}}')
        print(name,'confirmed activity',activity,flush=True)
        assert activity['distance']>2 and activity['shots']>=2,activity
        return dict(result,activity=activity)
    finally:
        page.mouse.up()
        page.keyboard.up('d')
        page.evaluate('window.combatMotionProbe=null')


def measure_turns(page, name):
    if FIXED_TURNS:
        life,yaw=page.evaluate('[harbourQA.player.life,harbourQA.player.yaw]')
        mouse(page,round(math.remainder(yaw,math.tau)/.002))
        page.wait_for_function("""life=>{const p=harbourQA.player;
            return p.life!==life || !p.hp || Math.abs(Math.atan2(Math.sin(p.yaw),Math.cos(p.yaw)))<.025;
        }""",arg=life,timeout=2500)
        if not page.evaluate("life=>harbourQA.player.life===life && harbourQA.player.hp>0",life):
            raise TurnLifeInterrupted((name,'align',life))
    pose=page.evaluate('()=>{const {x,z,yaw}=harbourQA.player;return {x,z,yaw}}')
    page.evaluate('window.turnStarted=performance.now();window.turnRanges=[];harbourQA.scene.profileFrames(3000)')
    if DRAW_PROFILE:
        page.evaluate('battleDrawProbe.start(harbourQA.scene.frameProfile())')
    life,start = page.evaluate('[harbourQA.player.life,harbourQA.player.yaw]')
    turns=int(os.environ.get('BATTLE_TURNS','12'))
    assert 1<=turns<=80
    for n in range(turns):
        if COMBAT_MOVEMENT:
            if n%12==8:
                page.keyboard.press('r')
            if n%12<8:
                page.mouse.down()
        if FIXED_TURNS:
            # Same angular trajectory in real time at any refresh rate. The final
            # packet always reaches 180 degrees, including after a dropped frame.
            page.evaluate("""sign=>new Promise(resolve=>{
                const count=()=>harbourQA.scene.frameProfile().length;
                const range=[null,null]; turnRanges.push(range);
                const start=performance.now(); let sent=0;
                const advance=now=>{
                    const target=Math.round(1571*Math.min(1,Math.max(0,(now-start)/100)));
                    if(target!==sent) {
                        if(range[0]===null) range[0]=count();
                        document.dispatchEvent(new MouseEvent('mousemove',{
                            movementX:sign*(target-sent),bubbles:true}));
                    }
                    sent=target;
                    if(target<1571) requestAnimationFrame(advance);
                    else requestAnimationFrame(()=>{range[1]=count();resolve()});
                };
                requestAnimationFrame(advance);
            })""",1 if n%2==0 else -1)
        else:
            for step in range(6):
                page.evaluate("""([dx,step])=>{
                    const count=()=>harbourQA.scene.frameProfile().length;
                    if(step===0) turnRanges.push([count(),null]);
                    document.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,bubbles:true}));
                    if(step===5) {
                        const range=turnRanges.at(-1);
                        requestAnimationFrame(()=>{range[1]=count()});
                    }
                }""", [(1 if n%2==0 else -1)*262, step])
                page.wait_for_timeout(15)
        if COMBAT_MOVEMENT:
            page.mouse.up()
        page.wait_for_timeout(180)
        expected = start if n%2 else start+math.pi
        try:
            page.wait_for_function("""([life,yaw])=>{
                const p=harbourQA.player, delta=p.yaw-yaw;
                return !p.hp || p.life!==life || Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<.25;
            }""",arg=[life,expected],timeout=1500)
        except PlaywrightTimeout as error:
            state=page.evaluate('()=>{const p=harbourQA.player;return {life:p.life,hp:p.hp,yaw:p.yaw,seq:p.seq,locked:!!document.pointerLockElement,phase:harbourQA.state.phase}}')
            raise AssertionError((name,n+1,expected,state)) from error
        hp,current_life=page.evaluate('[harbourQA.player.hp,harbourQA.player.life]')
        if not hp or current_life!=life:
            raise TurnLifeInterrupted((name,n+1,life,current_life,hp))
    return dict(read_profile(page, name, during_turn=True),turns=turns,startPose=pose,
                inputMode='fixed-100ms' if FIXED_TURNS else 'six-mouse-steps')


def read_profile(page, name, during_turn=False):
    frames = page.evaluate('harbourQA.scene.frameProfile()')
    ms = sorted(f['frameMs'] for f in frames)
    result = dict(site=name, frames=len(ms), fps=round(1000*len(ms)/sum(ms),1),
                  p95=ms[math.ceil(len(ms)*.95)-1], p99=ms[math.ceil(len(ms)*.99)-1], worst=max(ms),
                  over33=sum(t>33 for t in ms), cpuMs=round(sum(f['cpuMs'] for f in frames)/len(ms),1), calls=round(sum(f['calls'] for f in frames)/len(ms)),scale=frames[-1]['pixelRatio'],gpuMs=frames[-1].get('gpuMs'))
    if GPU_PROFILE:
        queries = [current['gpuQueryMs'] for previous, current in zip(frames, frames[1:])
                   if current.get('gpuQueryCount', 0) > previous.get('gpuQueryCount', 0)]
        result['gpuSamples'] = len(queries)
        if queries:
            result['gpuFrameMs'] = distribution(queries)
    if FRAME_PHASES:
        result['cpuPhases'] = {phase: distribution(f['phases'][phase] for f in frames)
                               for phase in frames[0]['phases']}
        for i in sorted(range(1,len(frames)),key=lambda j:frames[j]['frameMs'],reverse=True)[:3]:
            preceding = frames[i-1]
            if frames[i]['frameMs']>25:
                result.setdefault('delayedFrames',[]).append(dict(
                    ms=round(frames[i]['frameMs'],2), phases=preceding['phases'],
                    calls=preceding['calls'], triangles=preceding['triangles']))
    if during_turn:
        result['activeTurn'] = moving_frames(frames, page.evaluate('turnRanges'))
        if DRAW_PROFILE:
            result['drawProfile'] = page.evaluate('battleDrawProbe.finish(turnRanges)')
    print({k:v for k,v in result.items() if k!='drawProfile'}, flush=True)
    for i in sorted(range(1,len(frames)),key=lambda i:frames[i]['frameMs'],reverse=True)[:3]:
        if frames[i]['frameMs']>45:
            result.setdefault('slowFrames',[]).append(dict(ms=frames[i]['frameMs'], previous=frames[i-1]))
    if os.environ.get('BATTLE_SHADER_PROFILE')=='1':
        result['slowShaders']=page.evaluate("()=>window.slowShaders.filter(s=>s.start>=window.turnStarted).map(({start,duration,path})=>({start,duration,path}))")
    result['longTasks']=page.evaluate("""()=> (window.harbourLongFrames??[])
        .filter(f=>f.startTime>=(window.turnStarted??Infinity)).sort((a,b)=>b.duration-a.duration).slice(0,4)""")
    if os.environ.get('BATTLE_TIMER_PROFILE')=='1':
        result['timers']=page.evaluate(r"""()=> (window.roadTimers??[]).filter(t=>
          (window.harbourLongFrames??[]).some(f=>f.startTime>=window.turnStarted&&t.start>=f.startTime-1&&t.start<f.startTime+f.duration)
        ).map(t=>({start:t.start,duration:t.end-t.start,handler:t.handler,scheduled:t.origin.stack?.split('\n').slice(2,7)}))""")
    return result


with sync_playwright() as pw:
    browser = pw.chromium.launch(channel='chrome', headless=os.environ.get('HARBOUR_HEADED')!='1', args=['--enable-webgl','--ignore-gpu-blocklist'])
    width,height = map(int,os.environ.get('HARBOUR_VIEWPORT','1280x720').split('x'))
    quality=os.environ.get('BATTLE_GRAPHICS','performance')
    assert quality in ('auto','performance','high','ultra'),quality
    difficulty=os.environ.get('HARBOUR_DIFFICULTY','easy')
    assert difficulty in ('easy','normal','hard'),difficulty
    quality_suffix=('' if quality=='performance' else '-'+quality)+('-fixed-turns' if FIXED_TURNS else '')
    if difficulty!='easy':
        quality_suffix+='-'+difficulty
    if DRAW_PROFILE:
        quality_suffix+='-draw-profile'
    if GPU_PROFILE:
        quality_suffix+='-gpu-profile'
    if FRAME_PHASES:
        quality_suffix+='-cpu-phases'
    page = browser.new_page(viewport=dict(width=width,height=height), device_scale_factor=1)
    page.add_init_script(f"localStorage.setItem('altstadt.graphics.v3',{json.dumps(quality)})")
    page.add_init_script("""if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')){
        window.harbourLongFrames=[];
        new PerformanceObserver(list=>{for(const f of list.getEntries()){
          const tasks=f.scripts.map(s=>({url:s.sourceURL?.split('/').pop()?.split('?')[0],fn:s.sourceFunctionName,invoker:s.invoker,type:s.invokerType,ms:Math.round(s.duration)})).sort((a,b)=>b.ms-a.ms).slice(0,3);
          harbourLongFrames.push({startTime:f.startTime,duration:Math.round(f.duration),tasks});
          if(harbourLongFrames.length>100)harbourLongFrames.shift();
        }}).observe({type:'long-animation-frame'});
    }""")
    page.on('response',lambda r: print('HTTP',r.status,r.url.split('?')[0],flush=True) if r.status>=400 else None)
    page.on('pageerror',lambda error: print('Browserfehler:',str(error)[:350],flush=True))
    if os.environ.get('BATTLE_TIMER_PROFILE')=='1':
        page.add_init_script("""window.roadTimers=[];
          const nativeTimeout=window.setTimeout;
          window.setTimeout=function(callback,delay,...args){
            if(typeof callback!=='function')return nativeTimeout.call(this,callback,delay,...args);
            const origin=new Error();
            return nativeTimeout.call(this,function(...values){
              const record={origin,start:performance.now(),end:0,handler:callback.name||String(callback).slice(0,180)};
              try{return callback.apply(this,values);}
              finally{
                record.end=performance.now();roadTimers.push(record);
                if(roadTimers.length>512)roadTimers.splice(0,256);
              }
            },delay,...args);
          };""")
    page.on('console',lambda msg: print('Konsole:',msg.text[:350],flush=True) if msg.type=='error' else None)
    if os.environ.get('BATTLE_SHADER_PROFILE')=='1':
        def tag_draw(route):
            response=route.fetch()
            source=response.text()
            hook='this.renderBufferDirect = function(camera, scene, geometry, material, object, group) {'
            if hook in source:
                source=source.replace(hook,hook+'window.roadDrawObject=object;window.roadDrawMaterial=material;',1)
            route.fulfill(response=response, body=source)
        page.route(re.compile(r'/node_modules/\.vite/deps/chunk-[^/?]+\.js(?:\?|$)'),tag_draw)
        page.add_init_script("""window.slowShaders=[];
          const gl=WebGL2RenderingContext.prototype,info=gl.getProgramInfoLog;
          gl.getProgramInfoLog=function(program){
            const start=performance.now(),log=info.call(this,program),duration=performance.now()-start;
            if(duration>15){
              const m=window.roadDrawMaterial,o=window.roadDrawObject;
              const path=[];for(let a=o;a;a=a.parent){path.push(a.name||a.type)}
              const settings=this.getAttachedShaders(program).flatMap(s=>(this.getShaderSource(s)||'').split('\n').filter(x=>/^#define (USE_|SHADER_NAME|NUM_)/.test(x)));
              slowShaders.push({start,duration,material:m?.type,name:m?.name,map:m?.map?.image?.src,path,settings:[...new Set(settings)]});
            }
            return log;
          }""".replace("split('\n')","split('\\n')"))
    page.add_init_script("""window.observeHarbourBattle=(own,s,scene,worldBoxes)=>{
        window.harbourQA={player:own,state:s,scene,worldBoxes};
        """ + ("""            const probe=window.combatMotionProbe;
            if(probe && own && own.life===probe.life){
              probe.distance+=Math.hypot(own.x-probe.x,own.z-probe.z);
              probe.x=own.x;probe.z=own.z;
              for(const e of s.events){
                if(!probe.seen.has(e.eventId) && e.eventId){
                  probe.seen.add(e.eventId);
                  if(e.type==='shot' && e.id===own.id) probe.shots++;
                  if(e.type==='shot' && s.players.some(p=>p.id===e.id && p.kind==='bot')) probe.botShots++;
                  if(e.type==='hit' && e.id===own.id) probe.hits++;
                  if(e.type==='glass') probe.glass++;
                }
              }
            }""" if COMBAT_MOVEMENT else '') + "};")
    if not PRODUCTION:
        page.route(re.compile(r'/client/App\.tsx(\?|$)'), observe)
        # Keep the measured game on the version it opened with, including during local Vite edits.
        page.add_init_script("""window.WebSocket=class extends WebSocket {
          constructor(url, protocols){super(url,protocols);if(protocols==='vite-hmr')this.addEventListener('message',event=>event.stopImmediatePropagation());}
        }""")
    page.goto(BASE,wait_until='domcontentloaded')
    button = lambda name: page.get_by_role('button',name=name,exact=True)
    button('Verstanden · zur App').click()
    page.get_by_label('Benutzername',exact=True).fill('RoadQA'+str(int(time.time()))[-8:])
    page.get_by_label('Passwort',exact=True).fill('Local-Road-QA-4821')
    button('Profil anlegen & zur Lobby').click()
    map_id = os.environ.get('BATTLE_MAP','storm')
    if map_id == 'storm':
        button('Island').click()
    else:
        button('Zeitreise').click()
        page.locator('.city-map-'+map_id).click()
    page.get_by_role('button',name='Einzelspieler & Koop').click()
    page.get_by_label('Variante').select_option('battle')
    condition=os.environ.get('HARBOUR_CONDITION')
    if condition:
        page.get_by_label('Einsatzbedingungen').select_option(condition)
    enemies = int(os.environ.get('HARBOUR_ENEMIES', '0'))
    if enemies:
        page.get_by_label('Gefecht',exact=True).select_option('alone')
        page.get_by_label('Gegner',exact=True).select_option(str(enemies))
    else:
        page.get_by_label('Gefecht',exact=True).select_option('team')
    page.get_by_label('Schwierigkeit').select_option(difficulty)
    button('Charakter wählen & starten').click()
    button('Weiter zur Waffenauswahl').click()
    start = page.locator('.loadout-start')
    for _ in range(5):
        if start.is_enabled():
            break
        page.locator('.weapon-catalog button[aria-pressed=false]:enabled').first.click()
    start.click()
    print(map_id,'loadout submitted',flush=True)
    try:
        page.wait_for_function("window.harbourQA?.state.phase==='playing' && harbourQA.scene?.worldPrepared",timeout=90000)
    except Exception:
        print('Startdiagnose:',page.locator('body').inner_text()[-1000:],flush=True)
        raise
    page.evaluate('''Promise.race([harbourQA.scene.worldPrepared,new Promise((_,reject)=>setTimeout(()=>reject(Error("Scene warmup timeout")),90000))])''')
    renderer_info=page.evaluate("""()=>{
        const gl=document.querySelector('.city-canvas').getContext('webgl2');
        const ext=gl.getExtension('WEBGL_debug_renderer_info');
        return {renderer:gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
            timerQuerySupported:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
            quality:harbourQA.scene.getRenderStats().quality};
    }""")
    assert renderer_info['quality']==quality,(renderer_info,quality)
    print(renderer_info,flush=True)
    bots = page.evaluate("harbourQA.state.players.filter(p=>p.kind==='bot').length")
    assert bots == (enemies or 7), bots
    activate_controls(page)
    assert page.evaluate('harbourQA.state.mapId') == map_id
    assert page.evaluate('harbourQA.state.operation.config.difficulty') == difficulty
    print(map_id,'battle started with',bots,'bots',flush=True)
    exposed_cells=set()
    def approach(on_failure=None, goal=(51,-23)):
        # Plan around the actual map colliders, including closed doors at this spawn.
        # All movement still goes through the mouse and keyboard.
        def find_route():
            start, boxes, opponents = page.evaluate("""async()=>{
              const qa=harbourQA;
              let boxes;
              if(qa.worldBoxes) boxes=qa.worldBoxes();
              else {
                const {getWorld}=await import('/shared/world.ts');
                const {interiorWorld}=await import('/shared/interiors.ts');
                boxes=interiorWorld(getWorld('storm'),qa.state.interiors).boxes;
              }
              return [[qa.player.x,qa.player.z],boxes
                .filter(b=>b.y-b.h/2<1.75 && b.y+b.h/2>.29)
                .map(b=>[b.x,b.z,b.w,b.d]),qa.state.players
                .filter(p=>p.kind==='bot'&&p.team!==qa.player.team&&p.connected&&p.hp>0)
                .map(p=>[p.x,p.z])];
            }""")
            occupied=set()
            for bx,bz,bw,bd in boxes:
                for ix in range(math.ceil(bx-bw/2-1),math.floor(bx+bw/2+1)+1):
                    for iz in range(math.ceil(bz-bd/2-1),math.floor(bz+bd/2+1)+1):
                        occupied.add((ix,iz))
            origin=tuple(round(v) for v in start)
            opened=[(0,0,origin)]
            parent={origin:None}
            cost={origin:0}
            threat={}
            def danger(point):
                if point not in threat:
                    distance=min((math.hypot(point[0]-x,point[1]-z) for x,z in opponents),default=32)
                    threat[point]=max(0,(32-distance)/8)+(4 if point in exposed_cells else 0)
                return threat[point]
            while opened:
                _,steps,point=heapq.heappop(opened)
                if point==goal:
                    break
                if steps!=cost[point]:
                    continue
                px,pz=point
                for dx,dz in ((1,0),(-1,0),(0,-1),(0,1)):
                    dest=(px+dx,pz+dz)
                    if dest in occupied or math.hypot(*dest)>119:
                        continue
                    next_cost=steps+1+danger(dest)
                    if cost.get(dest,math.inf)<=next_cost:
                        continue
                    cost[dest]=next_cost
                    parent[dest]=point
                    priority=next_cost+abs(dest[0]-goal[0])+abs(dest[1]-goal[1])
                    heapq.heappush(opened,(priority,next_cost,dest))
            assert goal in parent, ('No walkable route',start)
            path=[goal]
            while path[-1]!=origin:
                path.append(parent[path[-1]])
            path.reverse()
            # Merge staircase turns into straight walks without cutting through
            # padded wall cells or getting appreciably closer to opponents.
            route=[]
            start=0
            while start+1<len(path):
                xa,za=path[start]
                best=start+1
                for end in range(len(path)-1,start+1,-1):
                    xb,zb=path[end]
                    stride=math.ceil(2*math.hypot(xb-xa,zb-za))
                    limit=max(map(danger,path[start:end+1]))+.25
                    segment=((round(xa+(xb-xa)*i/stride),round(za+(zb-za)*i/stride))
                             for i in range(1,stride+1))
                    if all(cell not in occupied and danger(cell)<=limit for cell in segment):
                        best=end
                        break
                route.append(path[best])
                start=best
            return route
        for attempt in range(4):
            try:
                life=page.evaluate('harbourQA.player.life')
                route=find_route()
                print('Street approach',route,flush=True)
                for i,(x,z) in enumerate(route):
                    walk(page,x,z,life=life,settle_ms=220 if i==len(route)-1 else 70)
                return
            except (AssertionError,PlaywrightTimeout) as event:
                if on_failure:
                    on_failure('street approach',attempt+1,event)
                if not isinstance(event,TurnLifeInterrupted) or attempt==3:
                    raise
                if event.position:
                    # On retry, prefer a detour past the last exposed stretch.
                    # Keep those cells legal when walls leave no alternative.
                    x,z=map(round,event.position)
                    exposed_cells.update((ix,iz) for ix in range(x-10,x+11) for iz in range(z-10,z+11))
                print('Anmarsch nach Gefechtstod erneut geplant:',event,flush=True)
                recover_life(page)
    if map_id != 'storm' or os.environ.get('BATTLE_SPAWN_TURNS')=='1' or COMBAT_MOVEMENT:
        # Short walk from the regular western team spawn, then look both ways in the street.
        if map_id=='storm' and COMBAT_MOVEMENT:
            approach()
        sx,sz = page.evaluate('[harbourQA.player.x,harbourQA.player.z]')
        page.evaluate('window.turnStarted=performance.now();harbourQA.scene.profileFrames(3000)')
        walk(page,sx+4,sz)
        entry=read_profile(page,map_id+' approach')
        profiler=None
        if os.environ.get('BATTLE_CPU_PROFILE')=='1':
            profiler=page.context.new_cdp_session(page)
            profiler.send('Performance.enable')
            profiler.send('Profiler.enable')
            profiler.send('Profiler.setSamplingInterval',{'interval':2000})
            profiler.send('Profiler.start')
            profile_start=page.evaluate('performance.now()')
        turn=measure(page,map_id)
        if profiler:
            profile=profiler.send('Profiler.stop')['profile']
            (OUT/f'{map_id}-first-turn.cpuprofile').write_text(json.dumps(profile))
            metrics={m['name']:m['value'] for m in profiler.send('Performance.getMetrics')['metrics']}
            navigation=metrics.get('NavigationStart')
            if navigation is not None:
                profile_start=profile['startTime']/1000-navigation*1000
            (OUT/f'{map_id}-profile-timing.json').write_text(json.dumps(dict(start=profile_start,tasks=turn['longTasks'])))
            profiler.detach()
        result=dict(bots=bots,width=width,height=height,quality=quality,difficulty=difficulty,renderer=renderer_info,entry=entry,turn=turn)
        suffix='-combat' if COMBAT_MOVEMENT else ''
        report=OUT/f'{map_id}-{bots}-bots-{width}x{height}{suffix}{quality_suffix}.json'
        report.write_text(json.dumps(result,indent=2))
        try:
            warm=measure(page,map_id+' repeat')
        except TurnLifeInterrupted as event:
            print('Drehserie durch Gefechtstod unterbrochen:',event,flush=True)
            page.wait_for_function('harbourQA.player.hp>0',timeout=20000)
            if not page.evaluate('!!document.pointerLockElement'):
                activate_controls(page)
            if map_id=='storm' and COMBAT_MOVEMENT:
                approach()
            walk(page,sx+4,sz)
            warm=measure(page,map_id+' repeat')
        result['warm']=warm
        page.screenshot(path=str(OUT/f'{map_id}-live-{width}x{height}.jpg'),type='jpeg',quality=88)
        if os.environ.get('BATTLE_SHADER_PROFILE')=='1':
            (OUT/f'{map_id}-slow-shaders.json').write_text(json.dumps(page.evaluate('window.slowShaders'),indent=2))
        report.write_text(json.dumps(result,indent=2))
        browser.close()
        raise SystemExit(0)

    shops=[('harbour-supply','Harbour Supply',51,-9,-18),('diner','Diner',63,-36,-28),
           ('coast-records','Coast Records',75,-9,-18)]
    only_shop=os.environ.get('HARBOUR_SHOP')
    if only_shop:
        shops=[shop for shop in shops if shop[0]==only_shop]
        assert shops, ('Unknown HARBOUR_SHOP',only_shop)
    suffix=(f'-{condition}' if condition else '')+(f'-{only_shop}' if only_shop else '')
    report_path=OUT/f'report-{bots}-bots-{width}x{height}{suffix}{quality_suffix}.json'
    run_id=time.time_ns()
    checkpoint=report_path.with_name(f'{report_path.stem}-{run_id}.partial.json')
    results = []
    report=dict(bots=bots,width=width,height=height,quality=quality,difficulty=difficulty,renderer=renderer_info,
                condition=condition or 'standard',runId=str(run_id),complete=False,results=results,routeFailures=[])
    def record_failure(stage,attempt,event):
        # Persist before any recovery, including the final exhausted attempt.
        report['routeFailures'].append(dict(stage=stage,attempt=attempt,error=type(event).__name__,
                                            detail=str(event)[:650]))
        write_report(checkpoint,report)
    write_report(checkpoint,report)
    print('Harbour Road checkpoint:',checkpoint,flush=True)
    approach(record_failure,(shops[0][2],-23))
    road_profiler=None
    if os.environ.get('BATTLE_CPU_PROFILE')=='1':
        road_profiler=page.context.new_cdp_session(page)
        road_profiler.send('Profiler.enable')
        road_profiler.send('Profiler.setSamplingInterval',{'interval':1500})
        road_profiler.send('Profiler.start')
        profile_start=page.evaluate('performance.now()')
    for _,name,x,inside,door in shops:
        for attempt in range(3):
            try:
                life=page.evaluate('harbourQA.player.life')
                walk(page,x,-23,life=life)
                page.evaluate('window.turnStarted=performance.now();harbourQA.scene.profileFrames(3000)')
                walk(page,x,door,life=life)
                walk(page,x,inside,life=life)
                entry=read_profile(page,name+' entrance')
                print('Entered',name,flush=True)
                if os.environ.get('HARBOUR_SCREENSHOTS')=='1':
                    page.screenshot(path=str(OUT/f'{width}x{height}-{condition or "standard"}-{name}.jpg'),type='jpeg',quality=90)
                    # Screenshots can synchronously read back the GPU. Discard that frame from the turn.
                    page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                result=measure(page,name)
                page.evaluate('window.turnStarted=performance.now();harbourQA.scene.profileFrames(3000)')
                walk(page,x,door,life=life)
                walk(page,x,-23,life=life)
                hp,current_life=page.evaluate('[harbourQA.player.hp,harbourQA.player.life]')
                verify_life(hp,current_life,life,name)
                results.append(dict(entry=entry,turn=result,exit=read_profile(page,name+' exit'),attempt=attempt+1))
                write_report(checkpoint,report)
                break
            except (AssertionError,PlaywrightTimeout) as event:
                record_failure(name,attempt+1,event)
                if not isinstance(event,TurnLifeInterrupted) or attempt==2:
                    raise
                print(name,'nach Gefechtstod erneut gestartet:',event,flush=True)
                recover_life(page)
                approach(record_failure,(x,-23))
        print('Exited',name,flush=True)
    page.screenshot(path=str(OUT/f'island-live-{width}x{height}.jpg'),type='jpeg',quality=88)
    if os.environ.get('HARBOUR_CLAIMS')=='1':
        walk(page,71.6,-23)
        walk(page,71.6,-32.6)
        yaw=page.evaluate('harbourQA.player.yaw')
        mouse(page,-round(math.remainder(math.pi/2-yaw,math.tau)/.002))
        page.get_by_text('Nachlass regeln',exact=False).wait_for(timeout=5000)
        page.keyboard.press('e')
        page.get_by_text('Ihr Antrag auf Weiterleben',exact=False).wait_for(timeout=5000)
        page.wait_for_timeout(550)
        page.keyboard.press('e')
        page.get_by_text('Für Ihre Sterbeurkunde',exact=False).wait_for(timeout=5000)
        print('Nachlassschalter: two successive decisions confirmed in game',flush=True)
    if road_profiler:
        profile=road_profiler.send('Profiler.stop')['profile']
        (OUT/'storm-shops.cpuprofile').write_text(json.dumps(profile))
        (OUT/'storm-shops-profile-timing.json').write_text(json.dumps(dict(start=profile_start)))
        road_profiler.detach()
    report['complete']=True
    write_report(checkpoint,report)
    checkpoint.replace(report_path)
    browser.close()
