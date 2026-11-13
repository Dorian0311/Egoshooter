import {createInteriors} from './interiors';
import {interiorWorld,insideBuilding,interiorFixtures} from '../shared/interiors';
import {createChainsaw} from './chainsaw';
import {createWanderers} from './wanderers';
import {createMapDetails,detailedPropKinds} from './mapDetails';
import {CameraMotion} from './cameraMotion';
import {loadEnvironmentUpgrade} from './environmentAssets';
import {addMilitaryRoofs} from './militaryRoofs';
import './weaponHud.css';
import {createPlayerNameplate,nameplateOccluded} from './playerNameplate';
import {defaultSettings,type GameSettings,type Action} from './gameSettings';
import {createWeaponModels} from './weaponModels.ts';
import {createMuzzleEffects} from './muzzleEffects.ts';
import {createHitEffects} from './hitEffects.ts';
import {headshotPose} from './headshotAnimation';
import * as T from "three";
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createGraphics} from './graphics.ts';
import type {GraphicsQuality} from './graphicsSettings.ts';
import {createRiver,addFacadeDetails,addAlpineBackdrop,batchStaticMeshes} from './scenery.ts';
import {createMaterials,projectBoxUVs} from './materials.ts';
import {addArchitecture,facadeColor} from './architecture.ts';
import {createRockGeometry} from './rockGeometry.ts';
import {createViewmodel,projectWeaponMuzzle} from './viewmodel.ts';
import {createFallbackHands} from './fallbackHands.ts';
import {loadSceneAssets} from './sceneAssets.ts';
import {loadHuman,createHuman} from './humanoid.ts';
import { getWorld,type MapId } from "../shared/world.ts";
import {
  move,
  neutral,
  type Input,
  type Player,
  type Snapshot,
  STEP,
  weapons,
} from "../shared/game.ts";
export function createScene(
  canvas: HTMLCanvasElement,
  send: (i: Input) => void,
  mapId:MapId="cologne",
  graphicsQuality:GraphicsQuality="auto",
  initialSettings:GameSettings=defaultSettings,
  onInteract:(id:string)=>void=()=>{},
  inspectionView?:{position:[number,number,number];target:[number,number,number]},
) {
  let settings=initialSettings,enabled=true;
  const pressed=(action:Action)=>keys.has(settings.bindings[action]);
  const world=getWorld(mapId),{boxes,buildings}=world;
  let collisionWorld=world;
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor("#b8c1c0");
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  const pmrem=new T.PMREMGenerator(renderer),roomEnvironment=new RoomEnvironment();
  const environment=pmrem.fromScene(roomEnvironment,.04);roomEnvironment.dispose();pmrem.dispose();
  const scene = new T.Scene();
  scene.fog = new T.FogExp2("#bbc5cc",.0028);
  scene.environment=environment.texture;scene.environmentIntensity=.35;
  const camera = new T.PerspectiveCamera(72, 1, 0.08, 350);
  const cameraMotion=new CameraMotion();let eyeHeight=1.6,sprintToggled=false;
  camera.rotation.order = "YXZ";
  const skyLight=new T.HemisphereLight("#c0d4ed", "#5e5241", .45);
  skyLight.layers.enable(1);scene.add(skyLight);
  const sun = new T.DirectionalLight("#fff0e0", 2.8);
  if(mapId==='storm'){sun.color.set('#fff2d0');sun.intensity=3.1;}
  if(mapId==='frontline'){sun.color.set('#ffd6a3');sun.intensity=2.7;}
  sun.layers.enable(1);
  sun.position.set(-35, 28, 25);
  sun.castShadow = true;
  scene.add(sun);
  const materialLibrary=createMaterials(renderer);
  const mat=(color:string)=>materialLibrary.get(color);
  function cube(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    parent: T.Object3D = scene,
  ) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    if(mesh.material.map)projectBoxUVs(mesh.geometry,mesh.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const river=mapId==='cologne'?createRiver(scene):undefined;
  if(mapId==='cologne'){
    cube(-53,-.2,0,46,.4,150,'#77766b');cube(53,-.2,0,46,.4,150,'#77766b');
    for(const z of [-8.8,8.8])for(const start of [-30,-10,10]){const points=Array.from({length:25},(_,i)=>new T.Vector3(start+i*20/24,1+9*Math.sin(Math.PI*i/24),z));const arch=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.16,6,false),mat('#394c43'));arch.castShadow=true;scene.add(arch);for(let i=1;i<4;i++)cube(start+i*5,(1+9*Math.sin(Math.PI*i/4))/2,z,.16,1+9*Math.sin(Math.PI*i/4),.16,'#4b5b4f');}
    for(const z of [-5.5,-3,3,5.5])cube(0,.06,z,61,.12,.1,'#4b4d43');
    for(let x=-30;x<=30;x+=1)for(const z of [-4.25,4.25])cube(x,.025,z,.2,.05,3.3,'#594b37');
    cube(-88,8,-45,25,16,23,'#726d61');for(const z of [-53,-37]){cube(-78,18,z,5,36,5,'#777365');const spire=new T.Mesh(new T.ConeGeometry(3.6,16,8),mat('#4c514a'));spire.position.set(-78,44,z);spire.castShadow=true;scene.add(spire);}
  }else if(mapId==='alpine'){
    renderer.setClearColor('#bac9d2');scene.fog=new T.Fog('#bac9d2',85,310);cube(0,-.2,0,150,.4,150,'#deded4');cube(0,-.01,0,140,.05,14,'#8b8a7d');
    addAlpineBackdrop(scene);
  }else if(mapId==='frontline'){
    scene.fog=new T.Fog('#b6a391',90,310);
  }else{
    scene.fog=new T.Fog('#b9d5d3',105,310);
  }
  const coverVisuals:{box:(typeof boxes)[number];mesh:T.Mesh}[]=[];
  for (const b of boxes){
    if(b.kind==='interior'||detailedPropKinds.has(b.kind??''))continue;
    if(b.kind==='rock'){const rock=new T.Mesh(createRockGeometry(b),mat('#818783'));rock.position.set(b.x,b.y,b.z);rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);continue;}
    const buildingIndex=buildings.findIndex(item=>Math.abs(b.x-item.x)<=item.w/2+.1&&Math.abs(b.z-item.z)<=item.d/2+.1);
    const visual=cube(
      b.x,
      b.y,
      b.z,
      b.w,
      b.h,
      b.d,
      ["steel","railing"].includes(b.kind??"")?"#42594d":b.kind==="bridge"?"#8d8776":b.kind==="rock"?"#818783":b.kind === "roof"
        ? "#68534a"
        : b.kind === "furniture"
          ? "#67513d"
          : b.kind === "cover"
            ? "#5f6557"
            : b.kind === "stair" || b.kind === "floor"
              ? "#827866"
              : facadeColor(Math.max(0,buildingIndex)),
    );
    if(b.kind==='cover')coverVisuals.push({box:b,mesh:visual});
  }
  const disposeAssets=loadSceneAssets(scene,renderer,coverVisuals);
  for (const b of buildings) {
    if(mapId!=='storm'){
    const shape = new T.Shape();
    shape.moveTo(-b.w / 2 - 0.5, 0);
    shape.lineTo(0, 2.4);
    shape.lineTo(b.w / 2 + 0.5, 0);
    shape.closePath();
    const roof = new T.Mesh(
      new T.ExtrudeGeometry(shape, { depth: b.d + 1, bevelEnabled: false }),
      [mat(facadeColor(buildings.indexOf(b))),materialLibrary.roof],
    );
    const roofPositions=roof.geometry.getAttribute('position'),roofUVs=roof.geometry.getAttribute('uv');
    for(let i=0;i<roofPositions.count;i++)roofUVs.setXY(i,roofPositions.getZ(i)/3,Math.abs(roofPositions.getX(i))/3);
    roof.position.set(b.x, b.upper ? 8.3 : 4.3, b.z - b.d / 2 - 0.5);
    roof.castShadow = true;
    roof.receiveShadow = true;
    scene.add(roof);
    cube(b.x + 5, b.upper ? 9 : 5, b.z - 4, 1, 2, 1, "#9d8b75");
    }
    cube(b.x, 0.02, b.z, b.w, 0.04, b.d, "#a99c85");
    const label = document.createElement("canvas");
    label.width = 512;
    label.height = 64;
    const ctx = label.getContext("2d")!;
    ctx.fillStyle = "#293a33";
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = "#e5d8ae";
    ctx.font = "bold 25px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(b.name, 256, 43);
    const texture = new T.CanvasTexture(label);
    texture.colorSpace=T.SRGBColorSpace;
    const sign = new T.Mesh(
      new T.PlaneGeometry(7, 0.9),
      new T.MeshBasicMaterial({ map: texture }),
    );
    sign.position.set(b.x, 3.4, b.z + b.d / 2 + 0.26);
    scene.add(sign);
  }
  addFacadeDetails(scene,buildings,mat);
  if(mapId!=='storm')addArchitecture(scene,buildings,mat,true);
  const disposeMilitaryRoofs=mapId==='storm'?addMilitaryRoofs(scene,buildings,mat):undefined;
  const disposeEnvironmentUpgrade=loadEnvironmentUpgrade(scene,world,renderer);
  const mapDetails=createMapDetails(scene,world,mat,camera);
  for (const x of [-34, 34])
    for (const z of [-12, 12]) {
      cube(x, 2.6, z, 0.12, 5.2, 0.12, "#343d38");
      const bulb = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), mat("#f0d6a0"));
      bulb.position.set(x, 5.2, z);
      scene.add(bulb);
    }
  batchStaticMeshes(scene,new Set(coverVisuals.map(cover=>cover.mesh)));
  const interiors=createInteriors(scene,world);
  const interactionHint=document.createElement('div');interactionHint.style.cssText='position:absolute;bottom:23%;left:50%;transform:translateX(-50%);background:#15221ee6;color:#eef2df;padding:10px 18px;border:1px solid #cbd9a955;border-radius:6px;font:13px system-ui;pointer-events:none;z-index:4;display:none';canvas.parentElement?.append(interactionHint);
  const ammoReadout=document.createElement('div');ammoReadout.className='weapon-ammo';ammoReadout.setAttribute('aria-label','Munition an der Waffe');
  const ammoNumber=document.createElement('strong'),ammoReserve=document.createElement('span'),ammoStatus=document.createElement('small');
  ammoReadout.append(ammoNumber,ammoReserve,ammoStatus);canvas.parentElement?.append(ammoReadout);
  const ammoAnchor=new T.Vector3(),avatarPosition=new T.Vector3();
  const weapon = new T.Group();
  weapon.layers.set(1);
  const viewmodel=createViewmodel(weapon);
  camera.add(weapon);
  scene.add(camera);
  function cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    length: number,
    color: string,
    parent: T.Object3D,
  ) {
    const mesh = new T.Mesh(
      new T.CylinderGeometry(r, r, length, 12),
      mat(color),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const stockShape=new T.Shape();const stockPoints=[[.02,-.49],[.02,-.3],[.21,-.24],[.45,-.22],[1.05,-.22],[1.09,-.25],[1.07,-.29],[.5,-.3],[.34,-.35],[.25,-.48]];stockPoints.forEach(([u,v],i)=>i?stockShape.lineTo(u,v):stockShape.moveTo(u,v));stockShape.closePath();
  const stockGeometry=new T.ExtrudeGeometry(stockShape,{depth:.085,bevelEnabled:true,bevelThickness:.007,bevelSize:.007,bevelSegments:3,steps:1});stockGeometry.rotateY(Math.PI/2);stockGeometry.translate(.1975,0,0);projectBoxUVs(stockGeometry,new T.Vector3(),.23);const stock=new T.Mesh(stockGeometry,mat('#674b32'));stock.castShadow=true;weapon.add(stock);
  for(const z of [-1.01,-.7]){const band=new T.Mesh(new T.TorusGeometry(.053,.006,6,16),mat('#303936'));band.scale.y=.75;band.position.set(.24,-.235,z);weapon.add(band);}
  const triggerGuard=new T.Mesh(new T.TorusGeometry(.047,.006,6,16),mat('#303936'));triggerGuard.rotation.y=Math.PI/2;triggerGuard.scale.x=.65;triggerGuard.position.set(.24,-.3,-.4);weapon.add(triggerGuard);
  cylinder(0.24, -0.17, -0.85, 0.027, 0.9, "#303936", weapon);
  cylinder(0.24, -0.17, -0.48, 0.04, 0.22, "#414b46", weapon);
  cube(0.24, -0.205, -0.78, 0.08, 0.07, 0.45, "#82603c", weapon);
  cube(0.24, -0.13, -1.23, 0.012, 0.07, 0.025, "#242b28", weapon);
  cube(0.24, -0.11, -0.52, 0.048, 0.025, 0.04, "#242b28", weapon);
  cube(0.29, -0.17, -0.42, 0.08, 0.025, 0.025, "#414b46", weapon);
  const bolt = new T.Mesh(new T.SphereGeometry(0.025, 8, 6), mat("#303936"));
  bolt.position.set(0.33, -0.17, -0.42);
  weapon.add(bolt);
  function hand(x:number,y:number,z:number,angle:number){const g=new T.Group();g.position.set(x,y,z);g.rotation.z=angle;const palm=new T.Mesh(new T.CapsuleGeometry(.044,.06,4,10),mat('#b7a082'));palm.rotation.x=Math.PI/2;g.add(palm);for(let i=0;i<4;i++){const finger=new T.Mesh(new T.CapsuleGeometry(.011,.055,4,6),mat('#b7a082'));finger.position.set(-.032+i*.021,-.035,-.02);finger.rotation.x=-.7;g.add(finger);}const thumb=new T.Mesh(new T.CapsuleGeometry(.014,.04,4,6),mat('#b7a082'));thumb.position.set(.05,0,0);thumb.rotation.z=-.7;g.add(thumb);weapon.add(g);return g;}
  const weaponHands=[hand(.265,-.31,-.36,-.35),hand(.19,-.285,-.78,1.1)];
  const sleeve=cylinder(.31,-.43,-.22,.068,.3,'#232629',weapon);sleeve.rotation.x=.65;
  const flash = new T.Mesh(
    new T.SphereGeometry(0.09, 5, 4),
    new T.MeshBasicMaterial({ color: "#ffe5a1" }),
  );
  flash.position.set(0.24, -0.17, -1.32);
  weapon.add(flash);
  // A separate pistol silhouette rather than scaling down the rifle.
  const pistol=new T.Group();weapon.add(pistol);
  cube(.24,-.21,-.55,.065,.07,.32,'#303936',pistol);cylinder(.24,-.18,-.83,.018,.26,'#303936',pistol);
  const grip=cube(.24,-.34,-.42,.065,.2,.11,'#674b32',pistol);grip.rotation.x=-.35;
  cube(.24,-.15,-.5,.06,.035,.06,'#414b46',pistol);
  // Small firearm parts are blued steel, not the bridge's coarse rusted sheet metal.
  const firearmSteel=new T.MeshStandardMaterial({color:'#343a3e',metalness:.78,roughness:.38});
  const oldSteel=new Set(['#303936','#414b46','#242b28','#38413e'].map(mat));
  weapon.traverse(object=>{if(object instanceof T.Mesh&&!Array.isArray(object.material)&&oldSteel.has(object.material))object.material=firearmSteel;});
  const rifleParts=weapon.children.filter(c=>c!==pistol&&c!==flash);
  const fallbackHands=createFallbackHands(weapon);
  const detailedWeapons=createWeaponModels(weapon);
  const chainsaw=createChainsaw();weapon.add(chainsaw.group);
  const muzzleEffects=createMuzzleEffects(scene);
  const avatars = new Map<string, T.Group>();
  const wanderers=createWanderers(scene,mapId);
  function avatar(p:Player){
    const g=new T.Group();g.position.set(p.x,p.y,p.z);g.userData.team=p.team;g.userData.uniform=p.uniform;scene.add(g);avatars.set(p.id,g);
    const nameplate=createPlayerNameplate(canvas.parentElement!,p.name,p.team===local?.team);g.add(nameplate.anchor);g.userData.nameplate=nameplate;
    void loadHuman(p.uniform).then(data=>{if(stopped||avatars.get(p.id)!==g)return;const human=createHuman(data,p.team,mapId,mat(p.team==='de'?'#232629':mapId==='cologne'?'#6c7250':'#7a795e'),p.uniform);g.add(human.group);g.userData.human=human;}).catch(e=>console.warn('Human asset unavailable',String(e)));
    return g;
  }
  let snapshot: Snapshot | null = null,
    local: Player | null = null,
    myId = "",
    yaw = 0,
    pitch = 0,
    seq = 0,
    last = performance.now(),
    acc = 0,
    fire = false,
    aim = false,
    weaponIndex: Input["weapon"] = 0,
    reload = false,
    jump = false,
    stopped = false,
    lastStep = 0;
  const smg=new T.Group();weapon.add(smg);
  cube(.24,-.21,-.55,.09,.095,.38,'#303936',smg);
  cylinder(.24,-.2,-.86,.022,.28,'#303936',smg);
  cube(.24,-.35,-.57,.045,.24,.065,'#272d2a',smg);
  cube(.24,-.32,-.38,.055,.16,.085,'#674b32',smg);
  cube(.24,-.22,-.26,.07,.07,.2,'#674b32',smg);
  weapon.traverse(object=>object.layers.set(1));
  const hitEffects=createHitEffects(scene);
  const pending: Input[] = [];
  const traces:{line:T.Line;expires:number}[]=[];
  const keys = new Set<string>();
  let audio: AudioContext | null = null;
  const listeners: (() => void)[] = [];
  function listen(target: EventTarget, event: string, fn: EventListener) {
    target.addEventListener(event, fn);
    listeners.push(() => target.removeEventListener(event, fn));
  }
  let dragLook=false;
  canvas.tabIndex=0;
  const locked=()=>enabled&&(document.pointerLockElement===canvas||(dragLook&&document.activeElement===canvas));
  function release() {
    sprintToggled=false;
    keys.clear();
    fire = false;
    aim = false;
    reload = false;
    jump = false;
  }
  listen(window, "keydown", ((e: KeyboardEvent) => {
    if(e.code==='Escape'&&dragLook){dragLook=false;release();canvas.blur();return;}
    if (!locked()) return;
    keys.add(e.code);
    if(e.code===settings.bindings.sprint&&!e.repeat&&settings.sprintMode==='toggle')sprintToggled=!sprintToggled;
    if(e.code===settings.bindings.interact&&!e.repeat&&local?.hp){const target=interiors.interaction(local,yaw);if(target)onInteract(target.id);}
    if (Object.values(settings.bindings).includes(e.code)) e.preventDefault();
    if (e.code === settings.bindings.jump) jump = true;
    if (e.code === settings.bindings.reload) reload = true;
    if (e.code === settings.bindings.weapon1) weaponIndex = 0;
    if (e.code === settings.bindings.weapon2) weaponIndex = 1;
    if (e.code === settings.bindings.weapon3) weaponIndex = 2;
    if (e.code === settings.bindings.weapon4) weaponIndex = 3;
  }) as EventListener);
  listen(window, "keyup", ((e: KeyboardEvent) => {
    keys.delete(e.code);
  }) as EventListener);
  listen(window, "blur", release);
  listen(document, "pointerlockchange", () => {
    if (!locked()) release();
  });
  listen(document, "mousemove", ((e: MouseEvent) => {
    if (locked()) {
      yaw -= e.movementX * 0.002*settings.sensitivity*(aim?settings.aimSensitivity:1);
      pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * 0.002*settings.sensitivity*(aim?settings.aimSensitivity:1)));
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    }
  }) as EventListener);
  listen(window, "mousedown", ((e: MouseEvent) => {
    if (!locked()||(dragLook&&e.target!==canvas)) return;
    if (e.button === 0) fire = true;
    if (e.button === 2 && local?.uniform!=="leatherface") aim = true;
  }) as EventListener);
  listen(window, "mouseup", ((e: MouseEvent) => {
    if (e.button === 0) fire = false;
    if (e.button === 2) aim = false;
  }) as EventListener);
  listen(canvas, "contextmenu", (e) => e.preventDefault());
  listen(canvas, "click", () => {
    if (enabled && snapshot?.phase === "playing") {
      canvas.focus();
      if(!dragLook)try{Promise.resolve(canvas.requestPointerLock()).catch(()=>{dragLook=true;});}catch{dragLook=true;}
      audio ??= new AudioContext();
      void audio.resume();
    }
  });
  function roomSound(glass=false){
    if(!audio||audio.state!=='running'||!settings.volume)return;
    const length=glass?.28:.15,buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*length),audio.sampleRate),data=buffer.getChannelData(0);
    for(let n=0;n<data.length;n++)data[n]=(Math.random()*2-1)*Math.pow(1-n/data.length,2);
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type=glass?'highpass':'lowpass';filter.frequency.value=glass?1800:400;gain.gain.value=(glass?.08:.045)*settings.volume;source.connect(filter).connect(gain).connect(audio.destination);source.start();
  }
  function sound(p: Player | undefined, hit = false, step = false) {
    if (!audio || audio.state !== "running" || settings.volume===0) return;
    const room=local?insideBuilding(world,local.x,local.z):-1;
    const sourceRoom=p?insideBuilding(world,p.x,p.z):room;
    const muffled=room!==sourceRoom&&(room>=0||sourceRoom>=0);
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.type = hit || step ? "sine" : "sawtooth";
    oscillator.frequency.setValueAtTime(
      step ? (room>=0?(room%3===0?180:95):65) : hit ? 880 : p?.weapon===4 ? 75 : 100,
      audio.currentTime,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      step ? 30 : hit ? 440 : 35,
      audio.currentTime + 0.1,
    );
    gain.gain.setValueAtTime(
      (step ? 0.025 : hit ? 0.035 : 0.12)*settings.volume*(muffled?.28:1),
      audio.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
    if (p && local) {
      const pan = audio.createPanner();
      pan.panningModel = "HRTF";
      pan.distanceModel = "inverse";
      pan.refDistance = 4;
      pan.maxDistance = 120;
      pan.positionX.value = p.x;
      pan.positionY.value = p.y + 1;
      pan.positionZ.value = p.z;
      const filter=audio.createBiquadFilter();filter.type="lowpass";filter.frequency.value=muffled?650:14000;oscillator.connect(filter).connect(gain).connect(pan).connect(audio.destination);
    } else oscillator.connect(gain).connect(audio.destination);
    if(step&&local&&room>=0&&world.boxes.some(b=>b.kind==='stair'&&Math.abs(local!.x-b.x)<b.w/2&&Math.abs(local!.z-b.z)<b.d/2)){
      const creak=audio.createOscillator(),cg=audio.createGain();creak.type='triangle';creak.frequency.setValueAtTime(240,audio.currentTime);creak.frequency.exponentialRampToValueAtTime(90,audio.currentTime+.25);cg.gain.setValueAtTime(.012*settings.volume,audio.currentTime);cg.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.3);creak.connect(cg).connect(audio.destination);creak.start();creak.stop(audio.currentTime+.31);
    }
    if(room>=0){const delay=audio.createDelay(.15),echo=audio.createGain();delay.delayTime.value=.065;echo.gain.value=.22;gain.connect(delay).connect(echo).connect(audio.destination);}
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.16);
  }
  function update(s: Snapshot, id: string) {
    const oldPhase = snapshot?.phase;
    if(snapshot?.interiors&&s.interiors&&local){for(const f of interiorFixtures(world)){if(f.type==='door'&&snapshot.interiors.doors[f.id]!==s.interiors.doors[f.id]&&Math.hypot(f.box.x-local.x,f.box.z-local.z)<12){roomSound();break;}}}
    snapshot = s;interiors.sync(s.interiors);collisionWorld=interiorWorld(world,s.interiors);
    myId = id;
    const own = s.players.find((p) => p.id === id);
    if (own) {
      const before=local;
      const reset = !local || oldPhase !== s.phase || (!local.hp && own.hp > 0);
      local = { ...own };
      if (reset) {
        viewmodel.reset();
        yaw = own.yaw;
        pitch = own.pitch;
        pending.length = 0;
      } else {
        while (pending.length && pending[0].seq <= own.seq) pending.shift();
        for (const i of pending) move(local, i,STEP,collisionWorld);
      }
      cameraMotion.reconcile(before??undefined,local,reset);
    }
    for (const p of s.players)
      if (p.id !== id) {
        let g = avatars.get(p.id);
        if (g && (g.userData.team !== p.team || g.userData.uniform !== p.uniform)) {
          g.userData.nameplate?.dispose();
          g.userData.human?.dispose();scene.remove(g);
          g.traverse((o) => {
            if (o instanceof T.Mesh) o.geometry.dispose();
          });
          avatars.delete(p.id);
          g = undefined;
        }
        g ??= avatar(p);
        g.userData.target = p;
        g.userData.nameplate?.update(p.name,p.team===own?.team);
        if(p.hp>0)g.userData.headDestroyed=false;
        g.visible = p.hp > 0 || !!g.userData.headDestroyed;
      }
    for (const [id, g] of avatars)
      if (!s.players.some((p) => p.id === id)) {
        g.userData.nameplate?.dispose();
        g.userData.human?.dispose();scene.remove(g);
        g.traverse((o) => {
          if (o instanceof T.Mesh) o.geometry.dispose();
        });
        avatars.delete(id);
      }
    for (const e of s.events) {
      if(e.type==='glass'&&e.point&&local&&Math.hypot(e.point[0]-local.x,e.point[2]-local.z)<18)roomSound(true);
      if(e.type==='glass'||e.type==='shot'&&!s.events.some(hit=>hit.type==='hit'&&hit.id===e.id))interiors.impact(e);
      if(e.type==='hit'||e.type==='kill'){
        const shooter=s.players.find(p=>p.id===e.id),target=s.players.find(p=>p.id===e.target);
        const direction=shooter?new T.Vector3(-Math.sin(shooter.yaw)*Math.cos(shooter.pitch),Math.sin(shooter.pitch),-Math.cos(shooter.yaw)*Math.cos(shooter.pitch)):new T.Vector3(0,0,-1);
        if(shooter&&e.point)direction.set(e.point[0]-shooter.x,e.point[1]-shooter.y-(shooter.crouching?1:1.6),e.point[2]-shooter.z).normalize();
        const slowMotion=settings.headshotSlowMotion&&e.id===id;
        const lethalHeadshot=e.type==='kill'&&e.hitZone==='head';
        if(e.type!=='hit'||!s.events.some(k=>k.type==='kill'&&k.hitZone==='head'&&k.target===e.target&&k.id===e.id))hitEffects.emit(e,slowMotion,direction,target?.y);
        if(lethalHeadshot&&e.target){const victim=avatars.get(e.target);if(victim){
          victim.userData.headDestroyed=true;victim.userData.deathAt=performance.now();victim.userData.deathSlowMotion=slowMotion;
          const horizontal=direction.clone().setY(0);if(horizontal.lengthSq()<.0001)horizontal.set(0,0,-1);horizontal.normalize().applyAxisAngle(new T.Vector3(0,1,0),-(target?.yaw??0));
          victim.userData.deathAxis=new T.Vector3(horizontal.z,0,-horizontal.x);victim.visible=true;
        }}
      }
      if (e.type === "shot") {
        if(e.point){const shooter=s.players.find(p=>p.id===e.id);if(shooter){
          const direction=new T.Vector3(-Math.sin(shooter.yaw)*Math.cos(shooter.pitch),Math.sin(shooter.pitch),-Math.cos(shooter.yaw)*Math.cos(shooter.pitch));
          const start=e.id===id?projectWeaponMuzzle(detailedWeapons.muzzleWorld(),camera,graphics.weaponFov()):new T.Vector3(shooter.x,shooter.y+(shooter.crouching?1:1.4),shooter.z).addScaledVector(direction,.65);
          muzzleEffects.emit(start,direction);
          const geometry=new T.BufferGeometry().setFromPoints([start,new T.Vector3(...e.point)]);
          const line=new T.Line(geometry,new T.LineBasicMaterial({color:'#ffe3a1',transparent:true,opacity:.85,depthWrite:false,blending:T.AdditiveBlending}));
          scene.add(line);traces.push({line,expires:performance.now()+90});
        }}
        sound(s.players.find((p) => p.id === e.id));
        if (e.id === id){viewmodel.shot(e.weapon??0);pitch=Math.min(1.45,pitch+weapons[e.weapon??0].recoil*(aim?.7:1));yaw+=Math.sin(seq*2.3)*weapons[e.weapon??0].recoil*.2;}
      }
      if(e.type==="melee")sound(s.players.find(p=>p.id===e.id));
      if (e.type === "hit" && e.id === id) sound(undefined, true);
    }
  }
  const graphics=createGraphics(renderer,scene,camera,sun,graphicsQuality);
  let raf = 0;
  function frame(t: number) {
    if (stopped) return;
    // The waiting-room backdrop shares the GPU with the character preview.
    const menu=snapshot?.phase==='waiting'||snapshot?.phase==='finished';
    if(menu&&t-last<1000/15){raf=requestAnimationFrame(frame);return;}
    const dt = Math.min((t - last) / 1000, 0.1);
    last = t;
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      if (local && snapshot?.phase === "playing") {
        const i: Input = {
          ...neutral(++seq),
          forward: locked()
            ? Number(pressed("forward")) - Number(pressed("back"))
            : 0,
          side: locked()
            ? Number(pressed("right")) - Number(pressed("left"))
            : 0,
          yaw,
          pitch,
          sprint: locked()&&(settings.sprintMode==='toggle'?sprintToggled:pressed("sprint")),
          crouch: pressed("crouch"),
          jump,
          fire,
          reload,
          aim,
          weapon: local.uniform==='leatherface'?4:weaponIndex,
          time: snapshot.now + (performance.now() - receivedAt),
        };
        jump = false;
        reload = false;
        if (local.hp) {
          cameraMotion.beforeStep(local);
          move(local, i,STEP,collisionWorld);
          pending.push(i);
          if (pending.length > 120) pending.shift();
        }
        send(i);
      }
    }
    if (local) {
      const rendered=cameraMotion.sample(local,acc/STEP,dt);
      eyeHeight+=((local.crouching?1:1.6)-eyeHeight)*(1-Math.exp(-dt*16));
      camera.position.set(
        rendered.x,
        rendered.y + eyeHeight,
        rendered.z,
      );
      camera.rotation.set(pitch, yaw, 0);
    }
    if(inspectionView){camera.position.set(...inspectionView.position);camera.lookAt(...inspectionView.target);}
    camera.updateMatrixWorld();
    for (const g of avatars.values()) {
      const p = g.userData.target as Player;
      g.position.lerp(avatarPosition.set(p.x, p.y, p.z), 1 - Math.exp(-dt * 14));
      const renderYaw=g.userData.renderYaw??p.yaw;
      g.userData.renderYaw=renderYaw+Math.atan2(Math.sin(p.yaw-renderYaw),Math.cos(p.yaw-renderYaw))*(1-Math.exp(-dt*18));
      g.rotation.set(0,g.userData.renderYaw,0);
      if(!p.hp&&g.userData.headDestroyed){
        const pose=headshotPose((t-g.userData.deathAt)/1000,g.userData.deathSlowMotion);
        g.rotateOnAxis(g.userData.deathAxis,pose.fall*Math.PI/2+pose.recoil);g.position.y=p.y+pose.height;
      }
      g.userData.human?.setHeadVisible(!g.userData.headDestroyed);
      g.scale.y=p.crouching&&!g.userData.human?.group.userData.hasCrouchAnimation?.66:1;
      const nameplate=g.userData.nameplate as ReturnType<typeof createPlayerNameplate>|undefined;
      if(nameplate){
        nameplate.anchor.position.y=(p.crouching?1.43:2.06)/g.scale.y;
        const distance=g.position.distanceTo(camera.position),nearby=p.hp>0&&p.connected&&distance<45;
        if(nearby&&t-(g.userData.labelCheckAt??-1000)>100){
          nameplate.anchor.getWorldPosition(avatarPosition);g.userData.labelOccluded=nameplateOccluded(camera.position,avatarPosition,collisionWorld.boxes);g.userData.labelCheckAt=t;
        }
        nameplate.render(camera,canvas.clientWidth,canvas.clientHeight,nearby&&!g.userData.labelOccluded,Math.min(1,Math.max(0,(45-distance)/12)));
      }
      g.userData.human?.update(p,t,dt);
    }
    if (local && audio) {
      const l = audio.listener;
      l.positionX.value = local.x;
      l.positionY.value = local.y + 1.6;
      l.positionZ.value = local.z;
      l.forwardX.value = -Math.sin(yaw);
      l.forwardY.value = 0;
      l.forwardZ.value = -Math.cos(yaw);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
      if (
        local.hp &&
        local.grounded &&
        locked() &&
        (["forward","back","left","right"] as Action[]).some(pressed) &&
        t - lastStep > (pressed("sprint") ? 300 : 480)
      ) {
        sound(undefined, false, true);
        lastStep = t;
      }
    }
    flash.visible = false;
    const saw=local?.uniform==='leatherface';
    if(saw)aim=false;
    const hasDetailedWeapon=local?detailedWeapons.update(local.team,mapId,saw?4:local.weapon):false;
    chainsaw.group.visible=saw;chainsaw.update(t,!!(saw&&fire&&locked()));
    const pose=local?viewmodel.update({dt,now:t,weaponIndex:local.weapon,aim,yaw,pitch,
      moving:locked()?Math.min(1,Math.hypot(Number(pressed('forward'))-Number(pressed('back')),Number(pressed('right'))-Number(pressed('left')))):0,
      sprinting:!!local.sprinting,grounded:local.grounded,
      reloadRemainingMs:Math.max(0,local.reloadAt-((snapshot?.now??0)+t-receivedAt)),
      reloadDurationMs:weapons[local.weapon].reload,muzzleY:detailedWeapons.muzzleLocal().y,sightY:detailedWeapons.sightY()}):undefined;
    detailedWeapons.animatePose(pose?.reloadProgress??0,pose?.aimBlend??0);
    const hasFallbackHands=local?fallbackHands.update(local.weapon,local.team,mapId,!hasDetailedWeapon&&!saw):false;
    fallbackHands.animatePose(pose?.reloadProgress??0,pose?.aimBlend??0);
    pistol.visible=!saw&&local?.weapon===1&&!hasDetailedWeapon;smg.visible=!saw&&local?.weapon===2&&!hasDetailedWeapon;for(const part of rifleParts)part.visible=!saw&&local?.weapon===0&&!hasDetailedWeapon;
    for(const h of weaponHands)h.visible=!saw&&local?.weapon!==1&&!hasDetailedWeapon&&!hasFallbackHands;sleeve.visible=!saw&&local?.weapon!==1&&!hasDetailedWeapon&&!hasFallbackHands;
    weapon.visible = !inspectionView && !!local?.hp && snapshot?.phase === "playing";
    camera.fov = inspectionView?50:settings.fov-24*(pose?.aimBlend??0);
    camera.updateProjectionMatrix();
    ammoReadout.style.display=local?.hp&&snapshot?.phase==='playing'&&!saw?'block':'none';
    if(local&&!saw){
      weapon.updateWorldMatrix(true,false);weapon.localToWorld(ammoAnchor.set(.34,-.15,-.52));
      const projected=projectWeaponMuzzle(ammoAnchor,camera,62-12*(pose?.aimBlend??0)).project(camera);
      const labelWidth=ammoReadout.offsetWidth||164;
      const anchorX=Math.max(.56,Math.min(.91,(projected.x+1)/2))*canvas.clientWidth;
      ammoReadout.style.left=`${Math.max(12,Math.min(canvas.clientWidth-labelWidth-16,anchorX+12))}px`;
      ammoReadout.style.top=`${Math.max(55,Math.min(81,(1-projected.y)*50))}%`;
      const count=String(local.ammo).padStart(2,'0'),reserve=` / ${weapons[local.weapon].mag} · ${local.reserve} Reserve`,status=local.reloadAt?'NACHLADEN …':local.ammo===0?`${settings.bindings.reload.replace('Key','')} NACHLADEN`:weapons[local.weapon].name.toUpperCase();
      if(ammoNumber.textContent!==count)ammoNumber.textContent=count;
      if(ammoReserve.textContent!==reserve)ammoReserve.textContent=reserve;
      if(ammoStatus.textContent!==status)ammoStatus.textContent=status;
      ammoReadout.classList.toggle('is-empty',local.ammo===0);
    }
    for(let index=traces.length-1;index>=0;index--){const trace=traces[index];if(t>=trace.expires){scene.remove(trace.line);trace.line.geometry.dispose();(trace.line.material as T.Material).dispose();traces.splice(index,1);}}
    hitEffects.update(dt);muzzleEffects.update(dt);
    wanderers.update((snapshot?.now??0)+t-receivedAt,dt);
    interiors.update(local??undefined,t,dt);
    const target=local?.hp&&locked()?interiors.interaction(local,yaw):undefined;
    interactionHint.style.display=target?'block':'none';if(target)interactionHint.textContent=`[${settings.bindings.interact.replace('Key','')}] ${interiors.label(target.id)}`;
    const indoors=local&&insideBuilding(world,local.x,local.z)>=0;
    const hemisphere=scene.children.find(o=>o instanceof T.HemisphereLight) as T.HemisphereLight;
    if(hemisphere)hemisphere.intensity+=( (indoors?.19:.45)-hemisphere.intensity)*Math.min(1,dt*4);
    river?.update(t/1000);
    mapDetails.update(t/1000);
    graphics.render(dt,pose?.aimBlend??0,!menu);
    raf = requestAnimationFrame(frame);
  }
  let receivedAt = performance.now();
  raf = requestAnimationFrame(frame);
  return {
    setQuality:graphics.setQuality,
    setSettings(value:GameSettings){settings=value;release();},
    setEnabled(value:boolean){enabled=value;if(!value){release();dragLook=false;if(document.pointerLockElement===canvas)document.exitPointerLock();}},
    getRenderStats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,...graphics.stats()}),
    update(s: Snapshot, id: string) {
      receivedAt = performance.now();
      update(s, id);
    },
    dispose() {
      stopped = true;
      wanderers.dispose();interiors.dispose();interactionHint.remove();
      ammoReadout.remove();
      mapDetails.dispose();disposeMilitaryRoofs?.();disposeEnvironmentUpgrade();
      hitEffects.dispose();
      cancelAnimationFrame(raf);
      listeners.forEach((f) => f());
      if (locked()) document.exitPointerLock();
      void audio?.close();
      fallbackHands.dispose();chainsaw.dispose();
      for(const trace of traces){trace.line.geometry.dispose();(trace.line.material as T.Material).dispose();}
      for(const avatar of avatars.values()){avatar.userData.nameplate?.dispose();avatar.userData.human?.dispose();}
      scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          if(o instanceof T.InstancedMesh)o.dispose();
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            (m as T.MeshBasicMaterial).map?.dispose();
            m.dispose();
          }
        }
      });
      viewmodel.dispose();detailedWeapons.dispose();muzzleEffects.dispose();disposeAssets();graphics.dispose();environment.dispose();materialLibrary.dispose();
      renderer.dispose();
    },
  };
}
