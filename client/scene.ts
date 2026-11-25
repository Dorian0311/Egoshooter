import {weaponSlot,fallbackSidearm,SNIPER_ID,G43_SCOPE_ID,ROCKET_ID} from '../shared/weapons';
import {createCatSilencer} from './catSilencer';
import {createHarbourClaims} from './harbourClaims';
import {islandShops} from '../shared/islandStreet';
import {nearbyBoxes} from '../shared/boxIndex';
import {createBattleAudio,advanceFootstep,footstepMaterial,type StepState} from './battleAudio';
import {createAnatomy} from './anatomy';
import {createGore} from './gore';
import {createRemainsScene} from './remainsScene';
import {acquireWorldWeapon,retainWorldWeaponSession,worldWeaponStats} from './worldWeapons';
import {createOperationScene,createThrowingStarGeometry} from './operationScene';
import {isCrawling,shotStability,eyeHeight as actorEyeHeight,eyePosition as actorEyePosition,armCount,hasLost} from '../shared/injuries';
import {createInteriors} from './interiors';
import {bakeShopLights} from './shopLighting';
import {interiorWorld,insideBuilding,interiorFixtures} from '../shared/interiors';
import {createChainsaw} from './chainsaw';
import {createWanderers} from './wanderers';
import {createMapDetails,detailedPropKinds} from './mapDetails';
import {CameraMotion} from './cameraMotion';
import {actorBehindWall} from './actorOcclusion';
import {createActorDetails} from './actorDetails';
import {RemoteMotion} from './remoteMotion';
import {terrainHeight} from '../shared/terrain';
import {createContactShadows} from './contactShadows';
import {loadEnvironmentUpgrade} from './environmentAssets';
import {addMilitaryRoofs} from './militaryRoofs';
import './weaponHud.css';
import './sniperScope.css';
import {createPlayerNameplate,nameplateOccluded} from './playerNameplate';
import {createResidentVoice,residentLine} from './residentBanter';
import {residentProfile} from '../shared/residentProfiles';
import './residentBanter.css';
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
import {createCologneCathedral} from './cologneCathedral';
import {createCologneBridgeSteel} from './cologneBridge';
import {createMaterials,projectBoxUVs} from './materials.ts';
import {addArchitecture,facadeColor} from './architecture.ts';
import {createRockGeometry} from './rockGeometry.ts';
import {createViewmodel,projectWeaponMuzzle} from './viewmodel.ts';
import {createFallbackHands} from './fallbackHands.ts';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {loadSceneAssets} from './sceneAssets.ts';
import {loadHuman,createHuman} from './humanoid.ts';
import {islandUnderpass} from '../shared/islandRoute';
import { getWorld,type MapId } from "../shared/world.ts";
import {
  move,
  neutral,
  rayBox,
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
  readOnly=false,
  preserveDrawingBuffer=readOnly,
) {
  let settings=initialSettings,enabled=true,quality=graphicsQuality;
  const pressed=(action:Action)=>keys.has(settings.bindings[action]);
  const world=getWorld(mapId),{boxes,buildings}=world;
  let collisionWorld=world;
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer, powerPreference: 'high-performance' });
  const releaseWorldWeapons=retainWorldWeaponSession();
  renderer.shadowMap.enabled = true;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor("#b8c1c0");
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  const pmrem=new T.PMREMGenerator(renderer),roomEnvironment=new RoomEnvironment();
  const environment=pmrem.fromScene(roomEnvironment,.04);roomEnvironment.dispose();pmrem.dispose();
  const scene = new T.Scene();
  scene.matrixAutoUpdate=false;
  scene.fog = new T.FogExp2("#bbc5cc",.0028);
  scene.environment=environment.texture;scene.environmentIntensity=.35;
  const camera = new T.PerspectiveCamera(72, 1, 0.08, 350);
  const cameraMotion=new CameraMotion();let eyeHeight=1.6,sprintToggled=false;
  const chaseTarget=new T.Vector3(),chaseCamera=new T.Vector3(),chaseRay=new T.Vector3();
  const controlledCar=()=>snapshot?.phase==='playing'&&local?.hp&&!local.downedUntil
    ?snapshot.remoteCars?.find(car=>car.driver===local?.id&&car.driverLife===local?.life&&!car.spent)
    :undefined;
  camera.rotation.order = "YXZ";
  const island=mapId==='storm';
  const streetRooms=island?islandShops.map(shop=>{
    const front=shop.z+shop.front*shop.d/2;
    return {shop,opening:new T.Box3(
      new T.Vector3(shop.x-shop.w/2,0,front-.30),
      new T.Vector3(shop.x+shop.w/2,shop.h,front+.30))};
  }):[];
  const daylight=island?.70:.64;
  const skyLight=new T.HemisphereLight(island?'#c2d8f2':'#cfdaeb',island?'#9b8f77':'#827662',daylight);
  skyLight.layers.enable(1);scene.add(skyLight);
  const sun = new T.DirectionalLight("#fff0e0", 2.8);
  if(mapId==='storm'){sun.color.set('#fff0db');sun.intensity=2.9;}
  if(mapId==='frontline'){sun.color.set('#ffd6a3');sun.intensity=2.7;}
  sun.layers.enable(1);
  sun.position.set(-70,island?99.5:80,55);
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
    bevel = 0,
  ) {
    const geometry=bevel>0?new RoundedBoxGeometry(w,h,d,1,bevel):new T.BoxGeometry(w,h,d);
    const mesh = new T.Mesh(geometry, mat(color));
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
    scene.add(createCologneBridgeSteel());
    for(const z of [-5.5,-3,3,5.5])cube(0,.06,z,61,.12,.1,'#4b4d43');
    for(let x=-30;x<=30;x+=1)for(const z of [-4.25,4.25])cube(x,.025,z,.2,.05,3.3,'#594b37');
    scene.add(createCologneCathedral(mat('#827866').map!));
  }else if(mapId==='alpine'){
    renderer.setClearColor('#bac9d2');scene.fog=new T.Fog('#bac9d2',85,310);cube(0,-.2,0,177,.4,177,'#deded4');cube(0,-.01,0,140,.05,14,'#8b8a7d');
    addAlpineBackdrop(scene,mat('#818783').map!,mat('#deded4').map!);
  }else if(mapId==='frontline'){
    scene.fog=new T.Fog('#b6a391',90,310);
  }else{
    scene.fog=new T.Fog('#b9d5d3',105,310);
  }
  const coverVisuals:{box:(typeof boxes)[number];mesh:T.Mesh}[]=[];
  for (const b of boxes){
    if(b.kind==='interior'||detailedPropKinds.has(b.kind??''))continue;
    if(b.kind==='rock'){const rock=new T.Mesh(createRockGeometry(b,island),mat(island?'#858a79':'#818783'));rock.position.set(b.x,b.y,b.z);rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);continue;}
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
      scene,
      b.kind==='wall'||b.kind==='furniture'||b.kind==='wagon'?Math.min(.085,b.w*.12,b.h*.12,b.d*.12):0,
    );
    if(b.kind==='cover')coverVisuals.push({box:b,mesh:visual});
  }
  const daylightFog=scene.fog,daylightClear=renderer.getClearColor(new T.Color());
  const daylightSun=sun.color.clone(),daylightStrength=sun.intensity;
  const sceneAssets=loadSceneAssets(scene,renderer,coverVisuals,graphicsQuality,island);
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
    const cinema=mapId==='frontline'&&b.name==='UNION-LICHTSPIELE';
    const front=b.z+b.d/2;
    sign.position.set(b.x, cinema?4.32:3.4, front+(cinema?1.61:.26));
    scene.add(sign);
    if(cinema){
      const brass='#a58753',lacquer='#4a2928';
      cube(b.x,3.75,front+1,10.4,.2,2,lacquer);
      cube(b.x,3.89,front+1,9.8,.08,1.9,brass);
      cube(b.x,4.32,front+1.37,7.3,.99,.46,brass);
      cube(b.x,4.88,front+1.32,6.3,.13,.55,lacquer);
      // The screen faces the benches on the solid wall beside the entrance.
      cube(b.x+4,2.08,front-.32,4.3,2.5,.12,lacquer);
      cube(b.x+4,2.08,front-.39,4.04,2.24,.04,'#d5cbb4');
      const loader=new T.TextureLoader();
      const photo=loader.load('/shooter/posters/archiv-1935.jpg');
      photo.colorSpace=T.SRGBColorSpace;
      const projection=new T.Mesh(new T.PlaneGeometry(2.24*800/534,2.24),
        new T.MeshBasicMaterial({map:photo,toneMapped:false}));
      projection.rotation.y=Math.PI;
      projection.position.set(b.x+4,2.08,front-.415);
      scene.add(projection);
      const posters=[
        ['ausstellung',300/433],['rekrutierung',538/768],['musik',490/688],
        ['aufruf',768/582],['verschwiegenheit',548/768],['versailles',519/768],
      ] as const;
      for(const side of [-1,1]){
        const center=b.x+side*5.35;
        cube(center,1.92,front+.53,5.1,1.93,.54,brass);
        cube(center,1.92,front+.81,4.96,1.8,.035,lacquer);
        for(let slot=0;slot<3;slot++){
          const [motif,aspect]=posters[(side<0?0:3)+slot];
          const height=Math.min(1.5,1.54/aspect);
          const paper=loader.load(`/shooter/posters/${motif}.jpg`);
          paper.colorSpace=T.SRGBColorSpace;
          const print=new T.Mesh(new T.PlaneGeometry(height*aspect,height),
            new T.MeshStandardMaterial({map:paper,roughness:1}));
          print.position.set(center+(slot-1)*1.62,1.92,front+.835);
          print.receiveShadow=true;scene.add(print);
        }
      }
    }
    if(mapId==='frontline'||mapId==='cologne'){
      const shelter=['FELDPOST','ARBEITERHAUS WEST','AM DOMHOF','DEUTZER BAHNHOF'].includes(b.name);
      const exit=['GÜTERBAHNHOF','QUARTIER OST','BAHNWACHE'].includes(b.name);
      if(shelter||exit){
        const paint=document.createElement('canvas');
        paint.width=256;paint.height=192;
        const brush=paint.getContext('2d')!;
        brush.fillStyle='#e7e1cd';
        brush.textAlign='center';
        brush.font='bold 76px Georgia';
        brush.fillText(shelter?'LSR':'NA',128,76);
        brush.beginPath();
        brush.moveTo(119,88);brush.lineTo(137,88);brush.lineTo(137,147);
        brush.lineTo(156,147);brush.lineTo(128,180);brush.lineTo(100,147);
        brush.lineTo(119,147);brush.closePath();brush.fill();
        // Small gaps let the masonry show through the old paint.
        for(let i=0;i<760;i++)brush.clearRect((i*97)%251,(i*i+37*i)%191,2+i%4,2);
        const ink=new T.CanvasTexture(paint);
        ink.colorSpace=T.SRGBColorSpace;
        const marking=new T.Mesh(new T.PlaneGeometry(1.6,1.2),
          new T.MeshStandardMaterial({map:ink,transparent:true,opacity:.88,depthWrite:false,roughness:1}));
        const side=b.x<0?1:-1;
        marking.rotation.y=side*Math.PI/2;
        marking.position.set(b.x+side*(b.w/2+.235),1.85,b.z+(b.z>0?-6.5:6.5));
        marking.receiveShadow=true;
        scene.add(marking);
      }
    }
  }
  addFacadeDetails(scene,buildings,mat);
  if(mapId!=='storm')addArchitecture(scene,buildings,mat,true);
  const disposeMilitaryRoofs=mapId==='storm'?addMilitaryRoofs(scene,buildings,mat):undefined;
  const environmentUpgrade=loadEnvironmentUpgrade(scene,world,renderer);
  const mapDetails=createMapDetails(scene,world,mat,camera);
  const harbourStreet=island?scene.getObjectByName('Harbour Road'):undefined;
  const disposeShopLights=harbourStreet?bakeShopLights(harbourStreet):undefined;
  const claims=island?createHarbourClaims(scene):undefined;
  for (const x of [-34, 34])
    for (const z of [-12, 12]) {
      cube(x, 2.6, z, 0.12, 5.2, 0.12, "#343d38");
      const bulb = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), mat("#f0d6a0"));
      bulb.position.set(x, 5.2, z);
      scene.add(bulb);
    }
  batchStaticMeshes(scene,new Set(coverVisuals.map(cover=>cover.mesh)),world.id==='frontline'?32:64);
  const interiors=createInteriors(scene,world);
  const interactionHint=document.createElement('div');interactionHint.style.cssText='position:absolute;bottom:23%;left:50%;transform:translateX(-50%);background:#15221ee6;color:#eef2df;padding:10px 18px;border:1px solid #cbd9a955;border-radius:6px;font:13px system-ui;pointer-events:none;z-index:4;display:none';canvas.parentElement?.append(interactionHint);
  const ammoReadout=document.createElement('div');ammoReadout.className='weapon-ammo';ammoReadout.setAttribute('aria-label','Munition an der Waffe');
  const ammoNumber=document.createElement('strong'),ammoReserve=document.createElement('span'),ammoStatus=document.createElement('small');
  ammoReadout.append(ammoNumber,ammoReserve,ammoStatus);canvas.parentElement?.append(ammoReadout);
  const viewport={width:canvas.clientWidth,height:canvas.clientHeight};
  let ammoWidth=ammoReadout.offsetWidth||164;
  const hudResize=new ResizeObserver(entries=>{
    for(const entry of entries){
      if(entry.target===canvas){
        viewport.width=Math.round(entry.contentRect.width);viewport.height=Math.round(entry.contentRect.height);
      }else{
        const width=entry.borderBoxSize?.[0]?.inlineSize??ammoReadout.offsetWidth;
        if(width>0)ammoWidth=Math.round(width);
      }
    }
  });
  hudResize.observe(canvas);hudResize.observe(ammoReadout,{box:'border-box'});
  const scope=document.createElement('div');scope.className='sniper-scope';scope.hidden=true;
  scope.setAttribute('aria-hidden','true');canvas.parentElement?.append(scope);
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
  const detailedWeapons=createWeaponModels(weapon,model=>graphics.warmup(model,true));
  const catSilencer=island?createCatSilencer():undefined;
  if(catSilencer)weapon.add(catSilencer);
  const chainsaw=createChainsaw();weapon.add(chainsaw.group);
  const muzzleEffects=createMuzzleEffects(scene);
  const avatars = new Map<string, T.Group>();
  const contactShadows=createContactShadows(scene,buildings);
  const opaqueWalls=world.boxes.filter(box=>box.kind==='wall');
  const actorFrustum=new T.Frustum(),actorProjection=new T.Matrix4(),actorBounds=new T.Sphere(new T.Vector3(),3.5);
  const residentVoice=createResidentVoice();
  const wanderers=inspectionView?createWanderers(scene,mapId):{update(_time:number,_dt:number){},dispose(){}};
  const pendingActors=new Set<Promise<void>>(),preparedActors=new Set<T.Group>();
  let nextActorBuild=Promise.resolve(),worldWarmed=false,actorUpload:Promise<void>|undefined;
  // A shared GLTF may resolve a whole squad in one microtask. Give each CPU rig build its own frame.
  function buildActor<T>(work:()=>T):Promise<T>{
    const result=nextActorBuild.then(()=>new Promise<T>((resolve,reject)=>requestAnimationFrame(()=>{
      try{resolve(work());}catch(error){reject(error);}
    })));
    nextActorBuild=result.then(()=>{},()=>{});
    return result;
  }
  function queueActorUpload(group:T.Group){
    preparedActors.add(group);
    if(!worldWarmed)return;
    if(!actorUpload)actorUpload=new Promise<void>((resolve,reject)=>requestAnimationFrame(()=>{
      const roots=[...preparedActors].filter(actor=>actor.parent?.parent===scene);
      preparedActors.clear();actorUpload=undefined;
      try{if(!stopped&&roots.length)graphics.warmupWorldDraw(roots,true);resolve();}catch(error){reject(error);}
    }));
    return actorUpload;
  }
  function avatar(p:Player){
    const g=new T.Group();g.position.set(p.x,p.y,p.z);g.userData.team=p.team;g.userData.uniform=p.uniform;g.userData.civilian=p.kind==='resident';scene.add(g);avatars.set(p.id,g);
    const nameplate=createPlayerNameplate(canvas.parentElement!,p.name,p.team===local?.team,p.kind==='resident'?residentProfile(p.id).biography:undefined);g.add(nameplate.anchor);g.userData.nameplate=nameplate;
    const task=loadHuman(p.uniform,p.kind==='resident').then(data=>buildActor(()=>{
      if(stopped||avatars.get(p.id)!==g)return;
      const human=createHuman(data,p.team,mapId,mat(p.team==='de'?'#232629':mapId==='cologne'?'#6c7250':'#7a795e'),p.uniform,p.kind==='resident',p.id);
      return human;
    })).then(async human=>{
      if(!human)return;
      try{await graphics.warmup(human.group);}catch(error){console.warn('Character shader warmup unavailable',error);}
      const added=await buildActor(()=>{
        if(stopped||avatars.get(p.id)!==g){human.dispose();return false;}
        g.add(human.group);g.userData.human=human;g.userData.details=createActorDetails(human.group);
        g.userData.anatomy=createAnatomy(human.group);
        g.userData.anatomy.setLost((g.userData.target as Player)?.injuries.lost??0);
        return true;
      });
      if(added)await queueActorUpload(human.group);
    }).catch(e=>console.warn('Human asset unavailable',String(e)));
    pendingActors.add(task);void task.then(()=>pendingActors.delete(task));
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
    firePressed = false,
    aim = false,
    weaponIndex: Input["weapon"] = 0,
    reload = false,
    jump = false,
    stopped = false;
  const smg=new T.Group();weapon.add(smg);
  cube(.24,-.21,-.55,.09,.095,.38,'#303936',smg);
  cylinder(.24,-.2,-.86,.022,.28,'#303936',smg);
  cube(.24,-.35,-.57,.045,.24,.065,'#272d2a',smg);
  cube(.24,-.32,-.38,.055,.16,.085,'#674b32',smg);
  cube(.24,-.22,-.26,.07,.07,.2,'#674b32',smg);
  weapon.traverse(object=>object.layers.set(1));
  const handStar=new T.Mesh(createThrowingStarGeometry(),new T.MeshStandardMaterial({color:'#aeb8b9',metalness:.9,roughness:.25}));handStar.position.set(-.08,-.05,-.45);handStar.layers.set(1);handStar.visible=false;weapon.add(handStar);
  const hitEffects=createHitEffects(scene);
  const gore=createGore(scene,()=>collisionWorld),operationScene=createOperationScene(scene),seenEvents=new Set<string>();
  const remainsScene=createRemainsScene(scene,camera,weapon,mapId,id=>avatars.get(id)?.userData.human?.group);
  let lastAmbienceAt:number|undefined;
  let condition="",shakeAt=0,shakeStrength=0;
  const pending: Input[] = [];
  const keys = new Set<string>();
  let audio: AudioContext | null = null,audioOutput:GainNode|null=null,audioCapture:MediaStreamAudioDestinationNode|null=null;
  const battleAudio=createBattleAudio(()=>audio,()=>audioOutput,camera),stepPositions=new Map<string,StepState>();
  async function startAudio(){if(!audio){audio=new AudioContext();audioOutput=audio.createGain();audioCapture=audio.createMediaStreamDestination();audioOutput.connect(audio.destination);audioOutput.connect(audioCapture);}await audio.resume();await battleAudio.load();}

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
    firePressed = false;
    aim = false;
    reload = false;
    jump = false;
  }
  listen(window, "keydown", ((e: KeyboardEvent) => {
    if(locked()&&controlledCar()&&(e.code==='Escape'||e.code===settings.bindings.interact)&&!e.repeat){
      onInteract('car:exit');return;
    }
    if(e.code==='Escape'&&dragLook){dragLook=false;release();canvas.blur();return;}
    if (!locked()) return;
    keys.add(e.code);
    if(controlledCar()){
      if(Object.values(settings.bindings).includes(e.code))e.preventDefault();
      return;
    }
    if(e.code===settings.bindings.sprint&&!e.repeat&&settings.sprintMode==='toggle')sprintToggled=!sprintToggled;
    if(e.code===settings.bindings.interact&&!e.repeat&&local?.hp){const target=remainsScene.interaction(local,yaw)??operationScene.interaction(local,yaw)??interiors.interaction(local,yaw)??claims?.interaction(local,yaw);if(target?.id==='harbour-claims'){claims?.use(performance.now());return;}if(target){const alternate='alternateId' in target&&typeof target.alternateId==='string'?target.alternateId:undefined;onInteract((e.shiftKey||pressed('sprint'))&&alternate?alternate:target.id);}}
    if(e.code===settings.bindings.throwStar&&!e.repeat&&local?.hp)onInteract('throw');
    if(e.code===settings.bindings.rocket&&!e.repeat&&local?.hp)onInteract('rocket');
    if(e.code===settings.bindings.bandage&&!e.repeat&&local?.hp)onInteract('bandage');
    if (Object.values(settings.bindings).includes(e.code)) e.preventDefault();
    if (e.code === settings.bindings.jump) jump = true;
    if (e.code === settings.bindings.reload) reload = true;
    const slot=(['weapon1','weapon2','weapon3','weapon4','weapon5'] as Action[]).findIndex(action=>e.code===settings.bindings[action]);
    if(slot>=0){
      if(!e.repeat&&local){if(local.heldPart)onInteract('part:drop');else if(local.carriedCorpse&&weapons[weaponSlot(local.loadout,slot)].kind!=='pistol')onInteract('corpse:drop');}
      weaponIndex=slot as Input['weapon'];
    }
  }) as EventListener);
  listen(window, "keyup", ((e: KeyboardEvent) => {
    keys.delete(e.code);
  }) as EventListener);
  listen(window, "blur", release);
  listen(document, "pointerlockchange", () => {
    if (!locked()){if(controlledCar())onInteract('car:exit');release();}
  });
  listen(document, "mousemove", ((e: MouseEvent) => {
    if (locked()&&!controlledCar()) {
      yaw -= e.movementX * 0.002*settings.sensitivity*(aim?settings.aimSensitivity:1);
      pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * 0.002*settings.sensitivity*(aim?settings.aimSensitivity:1)));
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    }
  }) as EventListener);
  listen(window, "mousedown", ((e: MouseEvent) => {
    if (!locked()||(dragLook&&e.target!==canvas)) return;
    if(controlledCar()){if(e.button===0)onInteract('car:explode');return;}
    if (e.button === 0){fire=true;firePressed=true;}
    if (e.button === 2 && local?.weapon!==4) aim = true;
  }) as EventListener);
  listen(window, "mouseup", ((e: MouseEvent) => {
    if (e.button === 0) fire = false;
    if (e.button === 2) aim = false;
  }) as EventListener);
  listen(canvas, "contextmenu", (e) => e.preventDefault());
  listen(canvas, "click", () => {
    if (enabled && snapshot?.phase === "playing") {
      canvas.focus();
      if(!locked())try{Promise.resolve(canvas.requestPointerLock()).catch(()=>{dragLook=true;});}catch{dragLook=true;}
      void startAudio();
    }
  });
  function audioPoint(p:Player|undefined){return p&&p.id!==myId?new T.Vector3(p.x,p.y+actorEyeHeight(p),p.z):undefined;}
  function audioMuffled(point:{x:number;z:number}|undefined){return !!point&&insideBuilding(world,point.x,point.z)!==insideBuilding(world,camera.position.x,camera.position.z);}
  function roomSound(point:T.Vector3){battleAudio.effect('door',point,.22*settings.volume,1,audioMuffled(point));}
  function sound(p:Player|undefined,weapon:number|undefined=p?.weapon){
    if(!p||weapon===undefined)return;
    battleAudio.shot(weapon,audioPoint(p),settings.volume,audioMuffled(p)||(island&&weapon===2),weapons[weapon]?.name,insideBuilding(world,p.x,p.z)>=0);
  }
  function update(s: Snapshot, id: string) {
    const oldPhase = snapshot?.phase;
    const previousCar=controlledCar()?.id;
    if(oldPhase&&oldPhase!==s.phase){battleAudio.clear();stepPositions.clear();}
    if(snapshot?.interiors&&s.interiors&&local){for(const f of interiorFixtures(world)){if(f.type==='door'&&snapshot.interiors.doors[f.id]!==s.interiors.doors[f.id]&&Math.hypot(f.box.x-local.x,f.box.z-local.z)<12){roomSound(new T.Vector3(f.box.x,f.box.y,f.box.z));break;}}}
    snapshot = s;interiors.sync(s.interiors);operationScene.sync(s);remainsScene.sync(s);
    if(condition!==s.operation.condition){
      condition=s.operation.condition;
      const night=condition==='night',fog=condition==='fog';
      const weatherFog=night?new T.Fog('#131d2c',20,100):fog?new T.Fog('#a8b3b0',4,42):null;
      scene.fog=weatherFog??daylightFog;
      sceneAssets.setWeatherBackground(weatherFog?.color??null);
      renderer.setClearColor(weatherFog?.color??daylightClear);
      sun.color.copy(daylightSun);
      if(night)sun.color.set('#abc8ee');
      sun.intensity=night?.24:fog?daylightStrength*.35:daylightStrength;
    }
    collisionWorld=interiorWorld(world,s.interiors);
    myId = id;
    const own = s.players.find((p) => p.id === id);
    const movingActors=[...s.players,...s.npcs];
    for(const key of stepPositions.keys())if(key!=='local'&&!movingActors.some(p=>p.id===key))stepPositions.delete(key);
    for(const p of movingActors){
      if(p.id===id)continue;
      const step=advanceFootstep(stepPositions.get(p.id),p,p.connected&&s.phase==='playing'&&oldPhase===s.phase);
      stepPositions.set(p.id,step.state);
      if(!step.step)continue;
      const point=new T.Vector3(p.x,p.y+.12,p.z),distance=point.distanceTo(camera.position);
      const enemy=p.kind!=='resident'&&!!own&&p.team!==own.team;
      const fade=Math.min(1,Math.max(0,(36-distance)/10));
      if(fade>0)battleAudio.footstep(footstepMaterial(collisionWorld,p),point,(enemy?.65:.24)*settings.volume*fade,p.sprinting,p.crouching,audioMuffled(p));
    }

    if (own) {
      if(s.phase==='waiting')detailedWeapons.preload(own.loadout);
      const before=local;
      const nextCar=s.remoteCars?.find(car=>car.driver===id&&car.driverLife===own.life&&!car.spent)?.id;
      const carChanged=previousCar!==nextCar;
      const reset = !local || oldPhase !== s.phase || (!local.hp && own.hp > 0)||carChanged;
      if(carChanged){firePressed=false;fire=false;aim=false;jump=false;reload=false;}
      if(before?.reloadAt&&(!own.hp||before.weapon!==own.weapon||!own.reloadAt&&s.now<before.reloadAt-100))battleAudio.cancelReload();
      if(own.reloadAt&&own.reloadAt!==before?.reloadAt)battleAudio.reload(own.weapon,Math.max(.1,(own.reloadAt-s.now)/1000),settings.volume);
      if(before&&own.hp&&before.weapon!==own.weapon)battleAudio.effect('equip',undefined,.19*settings.volume);
      if(reset)stepPositions.delete('local');
      local = { ...own };
      if (reset||readOnly) {
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
    const actors=[...s.players,...s.npcs],corpses=new Set(actors.filter(p=>!p.hp&&!p.downedUntil&&p.diedAt>0&&s.now-p.diedAt<10000).sort((a,b)=>b.diedAt-a.diedAt).slice(0,8).map(p=>p.id));
    for (const p of actors)
      if (p.id !== id) {
        let g = avatars.get(p.id);
        if (g && (g.userData.team !== p.team || g.userData.uniform !== p.uniform || g.userData.civilian !== (p.kind==='resident'))) {
          g.userData.nameplate?.dispose();
          g.userData.details?.dispose();g.userData.anatomy?.dispose();g.userData.human?.dispose();scene.remove(g);
          g.traverse((o) => {
            if (o instanceof T.Mesh) o.geometry.dispose();
          });
          avatars.delete(p.id);
          g = undefined;
        }
        g ??= avatar(p);
        const previous=g.userData.target as Player|undefined;
        const motion:RemoteMotion=g.userData.motion??=new RemoteMotion();
        motion.push(p,s.now,receivedAt,oldPhase!==s.phase||g.userData.life!==p.life||!!previous&&!!previous.hp!==!!p.hp);
        g.userData.target = p;
        g.userData.nameplate?.update(p.name,p.team===own?.team);
        if(g.userData.life!==p.life){g.userData.life=p.life;g.userData.headDestroyed=false;}
        if(p.hp>0)g.userData.headDestroyed=false;
        const body=s.corpses.find(c=>c.sourceId===p.id&&c.sourceLife===p.life);
        g.visible=p.hp>0||p.downedUntil>0||corpses.has(p.id)&&!(body&&remainsScene.isReady(body.id));
        g.userData.anatomy?.setLost(p.injuries.lost);
      }
    for (const [id, g] of avatars)
      if (!actors.some((p) => p.id === id)) {
        g.userData.nameplate?.dispose();
        g.userData.details?.dispose();g.userData.anatomy?.dispose();g.userData.human?.dispose();scene.remove(g);
        g.traverse((o) => {
          if (o instanceof T.Mesh) o.geometry.dispose();
        });
        avatars.delete(id);
      }
    for (const e of s.events) {
      if(e.eventId){if(seenEvents.has(e.eventId))continue;seenEvents.add(e.eventId);if(seenEvents.size>2048)seenEvents.delete(seenEvents.values().next().value!);}
      const eventActor=actors.find(p=>p.id===e.id),eventTarget=actors.find(p=>p.id===e.target);
      const eventPoint=e.point?new T.Vector3(...e.point):eventTarget?new T.Vector3(eventTarget.x,eventTarget.y+.7,eventTarget.z):e.target?remainsScene.eventPoint(e.target):audioPoint(eventActor);
      const eventMuffled=audioMuffled(eventPoint);
      if(e.type==='car-warning')battleAudio.effect('rc-warning',eventPoint,.8*settings.volume,1,eventMuffled);
      if(e.type==='car-gate'&&e.id===id)battleAudio.effect('confirm',undefined,.42*settings.volume);
      if(e.type==='explosion'&&e.point){
        operationScene.explosion(e.point,e.radius??3,performance.now());
        battleAudio.effect('blast',eventPoint,.85*settings.volume,1,eventMuffled);
        if(eventPoint&&eventPoint.distanceTo(camera.position)<9){shakeAt=performance.now();shakeStrength=.8;}
      }
      if(e.type==='glass'&&eventPoint)battleAudio.effect('glass',eventPoint,.32*settings.volume,1,eventMuffled);
      if(e.type==='sever')battleAudio.effect(settings.reducedGore?'flesh':'sever',eventPoint,.5*settings.volume,1,eventMuffled);
      if(e.type==='harvest-start'&&!settings.reducedGore)battleAudio.effect('harvest',eventPoint,.24*settings.volume,.85,eventMuffled);
      if(e.type==='part-pickup'||e.type==='corpse-carry')battleAudio.effect('body',eventPoint,.19*settings.volume,1,eventMuffled);
      if(e.type==='corpse-drop')battleAudio.effect('body',eventPoint,.36*settings.volume,.85,eventMuffled);
      if(e.type==='part-throw'||e.type==='throw')battleAudio.effect(e.weapon===ROCKET_ID?'rocket':'throw',audioPoint(eventActor),.23*settings.volume,1,eventMuffled);
      if(e.type==='pickup')battleAudio.effect('pickup',eventPoint,.2*settings.volume);
      if(e.type==='heal'||e.type==='medical-start'||e.type==='revive'||e.type==='medical-revive')battleAudio.effect('bandage',eventPoint,.2*settings.volume);
      if((e.type==='hit'||e.type==='kill')&&!s.events.some(other=>(other.type==='sever'||e.type==='hit'&&other.type==='kill')&&other.target===e.target&&other.id===e.id))battleAudio.effect('flesh',eventPoint,.29*settings.volume,1,eventMuffled);
      if(e.type==='kill'||e.type==='down')battleAudio.effect('body',eventPoint,.22*settings.volume,.9,eventMuffled);
      if(e.type==='glass'||e.type==='shot'&&!s.events.some(hit=>hit.type==='hit'&&hit.id===e.id))interiors.impact(e);
      if(e.type==='sever'&&e.target){const target=avatars.get(e.target);if(target&&e.bodyPart&&!settings.reducedGore){const persistent=s.bodyParts.some(part=>part.sourceId===e.target&&part.sourceLife===(e.life??target.userData.target?.life)&&part.part===e.bodyPart);const piece=persistent?undefined:target.userData.anatomy?.detach(e.bodyPart);if(piece){const shooter=actors.find(p=>p.id===e.id),contact=e.point?new T.Vector3(...e.point):piece.position.clone(),direction=shooter?contact.clone().sub(new T.Vector3(shooter.x,shooter.y+actorEyeHeight(shooter),shooter.z)):new T.Vector3(0,.1,-1);gore.add(piece,direction,contact,e.weapon);}if(e.point)hitEffects.emit(e,false,new T.Vector3(0,1,0),actors.find(p=>p.id===e.target)?.y);}}
      if(e.type==='harvest'&&e.target){const point=remainsScene.eventPoint(e.target);if(point&&!settings.reducedGore)hitEffects.emit({...e,type:'sever',point:point.toArray() as [number,number,number]},false,new T.Vector3(0,.7,.2),point.y-.1);if(e.id===id){shakeAt=performance.now();shakeStrength=.9;}battleAudio.effect(settings.reducedGore?'body':'harvest',point,.55*settings.volume,.9,audioMuffled(point));}
      if(e.type==='part-throw'){const root=avatars.get(e.id)?.userData.human?.group;if(root)root.userData.partThrowUntil=s.now+900;}
      if(e.type==='part-melee'){const root=avatars.get(e.id)?.userData.human?.group;if(root)root.userData.partSwingUntil=s.now+800;battleAudio.effect('swing',audioPoint(eventActor),.23*settings.volume,.85,audioMuffled(eventActor));}
      if(e.type==='shield')battleAudio.effect('flesh',eventPoint,.32*settings.volume,.8,eventMuffled);
      if(e.type==='hit'||e.type==='kill'){
        const shooter=actors.find(p=>p.id===e.id),target=actors.find(p=>p.id===e.target);
        const direction=shooter?new T.Vector3(-Math.sin(shooter.yaw)*Math.cos(shooter.pitch),Math.sin(shooter.pitch),-Math.cos(shooter.yaw)*Math.cos(shooter.pitch)):new T.Vector3(0,0,-1);
        if(shooter&&e.point)direction.set(e.point[0]-shooter.x,e.point[1]-shooter.y-(shooter.crouching?1:1.6),e.point[2]-shooter.z).normalize();
        const slowMotion=settings.headshotSlowMotion&&e.id===id;
        const lethalHeadshot=e.type==='kill'&&e.hitZone==='head';
        if(!settings.reducedGore&&(e.type!=='hit'||!s.events.some(k=>k.type==='kill'&&k.hitZone==='head'&&k.target===e.target&&k.id===e.id)))hitEffects.emit(e,slowMotion,direction,target?.y);
        if(lethalHeadshot&&e.target){const victim=avatars.get(e.target);if(victim){
          victim.userData.headDestroyed=true;victim.userData.deathAt=performance.now();victim.userData.deathSlowMotion=slowMotion;
          const horizontal=direction.clone().setY(0);if(horizontal.lengthSq()<.0001)horizontal.set(0,0,-1);horizontal.normalize().applyAxisAngle(new T.Vector3(0,1,0),-(target?.yaw??0));
          victim.userData.deathAxis=new T.Vector3(horizontal.z,0,-horizontal.x);victim.visible=true;
        }}
      }
      let impactSurface: 'wood'|'metal'|'stone'|'earth'|undefined;
      if(e.point&&(e.type==='impact'||e.type==='shot')){
        const [x,y,z]=e.point,margin=.20;
        const candidates=nearbyBoxes(collisionWorld.boxes,x-margin,z-margin,x+margin,z+margin);
        const box=candidates.find(b=>Math.abs(b.x-x)<b.w/2+margin&&Math.abs(b.y-y)<b.h/2+margin&&Math.abs(b.z-z)<b.d/2+margin);
        const sparksMargin=.16;
        const surface=box?.kind==='door'||box?.kind==='furniture'?'wood'
          :['truck','container','fence','steel','railing','wagon'].includes(box?.kind??'')?'metal'
          :box?'stone':footstepMaterial(collisionWorld,{x,y,z})==='earth'?'earth':'stone';
        if(e.type==='impact'||box&&Math.abs(box.y-y)<=box.h/2+sparksMargin||Math.abs(y-terrainHeight(x,z,world))<.15)impactSurface=surface;
        if(impactSurface&&(e.type==='impact'||!s.events.some(hit=>hit.type==='hit'&&hit.id===e.id))){
          battleAudio.effect(e.weapon===6?'body':surface,eventPoint,.24*settings.volume,1,eventMuffled);
        }
      }
      if (e.type === "shot") {
        if(e.point){const shooter=eventActor;if(shooter){
          const direction=new T.Vector3(-Math.sin(shooter.yaw)*Math.cos(shooter.pitch),Math.sin(shooter.pitch),-Math.cos(shooter.yaw)*Math.cos(shooter.pitch));
          const eye=actorEyePosition(shooter);
          const start=e.id===id?projectWeaponMuzzle(detailedWeapons.muzzleWorld(),camera,graphics.weaponFov()):new T.Vector3(eye.x,eye.y-.10,eye.z).addScaledVector(direction,.65);
          muzzleEffects.emit(start,direction,eventPoint,impactSurface);
        }}
        sound(eventActor,e.weapon??eventActor?.weapon);
        if (e.id === id){shakeAt=performance.now();const stability=local?shotStability(local):1;shakeStrength=.7*stability;viewmodel.shot(e.weapon??0,stability);pitch=Math.min(1.45,pitch+weapons[e.weapon??0].recoil*(aim?.7:1)*stability);yaw+=Math.sin(seq*2.3)*weapons[e.weapon??0].recoil*.2*stability;}
      }
      if(e.type==='melee')battleAudio.effect(e.weapon===4?'saw':'swing',audioPoint(eventActor),.28*settings.volume,1,audioMuffled(eventActor));
      if(e.type==='hit'&&e.target===id){shakeAt=performance.now();shakeStrength=1;battleAudio.effect('hurt',undefined,.28*settings.volume);}
      if(e.type==='hit'&&e.id===id)battleAudio.effect('confirm',undefined,.11*settings.volume);
    }
  }
  const graphics=createGraphics(renderer,scene,camera,sun,graphicsQuality);
  renderer.initTexture(muzzleEffects.texture);
  const worldPrepared=Promise.all([environmentUpgrade.ready,sceneAssets.ready]).then(async()=>{
    if(stopped)return;
    // Bot equipment can resolve after actor preparation. Use the actual shared materials and buffers
    // before a turn first exposes a distant bot and forces the driver to link its weapon program.
    const names=['kar98k','luger','mp40','g36'] as const;
    const assets=readOnly?[]:await Promise.all(names.map(name=>acquireWorldWeapon(name).catch(()=>null)));
    const equipment=new T.Group();
    try{
      if(stopped)return;
      for(const asset of assets)if(asset)equipment.add(asset.object);
      await Promise.all([graphics.warmup(scene),graphics.warmup(equipment),...pendingActors]);
      if(stopped)return;
      worldWarmed=true;
      const roots=[...preparedActors].filter(actor=>actor.parent?.parent===scene);preparedActors.clear();
      scene.add(equipment);
      environmentUpgrade.update(camera.position,'high');
      try{graphics.warmupWorldDraw(roots);}
      finally{environmentUpgrade.update(camera.position,quality);}
    }finally{
      equipment.removeFromParent();
      for(const asset of assets)asset?.release();
    }
  }).catch(error=>console.warn('World shader warmup unavailable',error));
  void Promise.all([graphics.warmup(muzzleEffects.group),graphics.warmup(operationScene.blastGroup)])
    .catch(error=>console.warn('Combat effects shader warmup unavailable',error));
  let captureFrame:(()=>void)|undefined;
  let raf = 0;
  const frameTimes:number[]=[],cpuTimes:number[]=[];
  type FrameSample={frameMs:number;cpuMs:number;shadowUpdated:boolean;resized:boolean;pixelRatio:number;gpuMs?:number;steps:number;calls:number;triangles:number;programs:number;detailDrawsSkipped:number};
  let profileLimit=0;const frameProfile:FrameSample[]=[];
  function frame(t: number) {
    if (stopped) return;
    if(document.hidden&&!readOnly){release();last=t;acc=0;raf=requestAnimationFrame(frame);return;}
    // The waiting-room backdrop shares the GPU with the character preview.
    const menu=snapshot?.phase==='waiting'||snapshot?.phase==='finished';
    if(!enabled||menu||!local?.hp||!settings.volume)residentVoice.stop();
    if(menu&&t-last<1000/15){raf=requestAnimationFrame(frame);return;}
    const cpuStarted=performance.now();frameTimes.push(t-last);if(frameTimes.length>180)frameTimes.shift();
    const frameMs=t-last;
    const dt = Math.min(frameMs / 1000, 0.1);
    last = t;
    acc += dt;
    let steps=0;
    while (acc >= STEP) {
      steps++;
      acc -= STEP;
      if (!readOnly&&local&&snapshot?.phase==="playing"&&!snapshot.operation.paused) {
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
          prone: pressed('prone'),
          jump,
          fire: !controlledCar()&&(fire||firePressed),
          reload: !controlledCar()&&reload,
          aim: !controlledCar()&&aim,
          weapon: armCount(local)===1?fallbackSidearm(local.loadout,local.weapon):weaponSlot(local.loadout,weaponIndex),
          time: snapshot.now + (performance.now() - receivedAt),
        };
        firePressed=false;
        jump = false;
        reload = false;
        if (local.hp&&!controlledCar()) {
          cameraMotion.beforeStep(local);
          move(local, i,STEP,collisionWorld);
          pending.push(i);
          if (pending.length > 120) pending.shift();
        }
        if(!readOnly)send(i);
      }
    }
    operationScene.update(t,dt);
    const car=controlledCar(),carPose=car&&operationScene.carPose(car.id);
    if (local) {
      const rendered=cameraMotion.sample(local,acc/STEP,dt);
      eyeHeight+=(actorEyeHeight(local)-eyeHeight)*(1-Math.exp(-dt*16));
      camera.position.set(
        rendered.x-(isCrawling(local)?Math.sin(yaw)*.55:0),
        rendered.y + eyeHeight,
        rendered.z-(isCrawling(local)?Math.cos(yaw)*.55:0),
      );
      camera.rotation.set(pitch, yaw, 0);
    }
    if(carPose&&!inspectionView){
      const {position,rotation}=carPose;
      chaseTarget.copy(position);chaseTarget.y+=.36;
      chaseCamera.set(position.x+Math.sin(rotation.y)*1.85,position.y+1.05,position.z+Math.cos(rotation.y)*1.85);
      chaseRay.copy(chaseCamera).sub(chaseTarget);
      let distance=chaseRay.length();chaseRay.normalize();
      const obstacles=nearbyBoxes(collisionWorld.boxes,Math.min(chaseTarget.x,chaseCamera.x)-.10,Math.min(chaseTarget.z,chaseCamera.z)-.10,Math.max(chaseTarget.x,chaseCamera.x)+.10,Math.max(chaseTarget.z,chaseCamera.z)+.10);
      const origin=chaseTarget.toArray(),direction=chaseRay.toArray();
      for(const b of obstacles)distance=Math.min(distance,rayBox(origin,direction,[b.x-b.w/2-.08,b.y-b.h/2-.08,b.z-b.d/2-.08],[b.x+b.w/2+.08,b.y+b.h/2+.08,b.z+b.d/2+.08]));
      camera.position.copy(chaseTarget).addScaledVector(chaseRay,Math.max(.13,distance-.10));
      camera.lookAt(chaseTarget);
    }
    if(inspectionView){camera.position.set(...inspectionView.position);camera.lookAt(...inspectionView.target);}
    if(!readOnly&&settings.cameraShake&&t-shakeAt<180){const amount=(1-(t-shakeAt)/180)*settings.cameraShake*shakeStrength;camera.rotation.z+=Math.sin(t*.07)*.012*amount;camera.position.y+=Math.sin(t*.09)*.012*amount;}
    if(local&&!local.hp&&!local.downedUntil&&snapshot?.operation.config.kind==='coop'){const ally=snapshot.players.find(p=>p.kind==='human'&&p.hp>0&&p.id!==local?.id);if(ally){camera.position.set(ally.x,ally.y+actorEyeHeight(ally),ally.z);camera.rotation.set(ally.pitch,ally.yaw,0);}}
    camera.updateMatrixWorld();
    actorFrustum.setFromProjectionMatrix(actorProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    // A shop has one open facade. Solid walls and ceiling hide the island when that facade leaves the view.
    const eye=camera.position;
    const room=island?streetRooms.find(({shop:s})=>eye.y>.12&&eye.y<s.h-.3&&
      Math.abs(eye.x-s.x)<s.w/2-.4&&Math.abs(eye.z-s.z)<s.d/2-.4):undefined;
    if(island){
      // The short far plane still spans the entire room, including its facade on the next turn.
      const far=room&&!actorFrustum.intersectsBox(room.opening)?24:350;
      if(camera.far!==far){
        camera.far=far;camera.updateProjectionMatrix();
        actorFrustum.setFromProjectionMatrix(actorProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      }
    }
    contactShadows.begin();
    let detailDrawsSkipped=0;
    for (const g of avatars.values()) {
      const p = g.userData.target as Player;
      if(!p.hp&&!p.downedUntil&&snapshot?.corpses.some(c=>c.sourceId===p.id&&c.sourceLife===p.life&&remainsScene.isReady(c.id)))g.visible=false;
      if(!g.visible){g.userData.nameplate?.render(camera,viewport.width,viewport.height,false,0);continue;}
      const remote=(g.userData.motion as RemoteMotion|undefined)?.sample(t)??p;
      g.position.set(remote.x,remote.y,remote.z);
      g.userData.renderYaw=remote.yaw;
      g.rotation.set(0,g.userData.renderYaw,0);
      const actorDistance=g.position.distanceTo(camera.position);
      actorBounds.center.copy(g.position);actorBounds.center.y+=1;
      const inView=actorDistance<6||actorFrustum.intersectsSphere(actorBounds);
      const compact=quality==='auto'||quality==='performance';
      const drawActor=inView&&(!compact||!p.hp||!actorBehindWall(camera.position,g.position,opaqueWalls));
      if(g.userData.human)g.userData.human.group.visible=drawActor;
      if(drawActor)detailDrawsSkipped+=g.userData.details?.update(actorDistance,viewport.height,camera.fov)??0;
      if(drawActor&&p.hp>0&&p.grounded)contactShadows.actor(remote.x,remote.y,remote.z,p.crouching||isCrawling(p));
      if(!p.hp&&!p.downedUntil&&p.diedAt){
        const pose=headshotPose(Math.max(0,((snapshot?.now??0)+t-receivedAt-p.diedAt)/1000),!!g.userData.deathSlowMotion);
        g.rotateOnAxis(g.userData.deathAxis??new T.Vector3(1,0,0),pose.fall*Math.PI/2+pose.recoil);g.position.y=p.y+pose.height;
      }
      if(isCrawling(p)&&(p.hp>0||p.downedUntil)){g.rotateX(-Math.PI/2);g.position.y=remote.y+.32;g.position.x+=Math.sin(g.userData.renderYaw)*1.05;g.position.z+=Math.cos(g.userData.renderYaw)*1.05;}
      if(!g.userData.anatomy)g.userData.human?.setHeadVisible(!g.userData.headDestroyed);
      g.scale.y=(p.crouching||p.treatment?.kind==='harvest')&&!g.userData.human?.group.userData.hasCrouchAnimation?.66:1;
      const nameplate=g.userData.nameplate as ReturnType<typeof createPlayerNameplate>|undefined;
      if(nameplate){
        if(isCrawling(p)){g.updateWorldMatrix(true,false);nameplate.anchor.position.copy(g.worldToLocal(new T.Vector3(p.x,p.y+.85,p.z)));}else nameplate.anchor.position.set(0,(p.crouching?1.43:p.kind==='resident'?(g.userData.human?.group.userData.nameplateHeight??2.06):2.06)/g.scale.y,0);
        const distance=g.position.distanceTo(camera.position),nearby=p.hp>0&&p.connected&&distance<45;
        if(nearby&&t-(g.userData.labelCheckAt??-1000)>100){
          nameplate.anchor.getWorldPosition(avatarPosition);g.userData.labelOccluded=nameplateOccluded(camera.position,avatarPosition,collisionWorld.boxes);g.userData.labelCheckAt=t;
        }
        const visible=nearby&&!g.userData.labelOccluded,now=(snapshot?.now??0)+t-receivedAt;
        if(p.kind==='resident'&&p.gestureUntil>now&&g.userData.banterGesture!==p.gestureUntil){
          g.userData.banterGesture=p.gestureUntil;
          if(enabled&&!menu&&local?.hp&&visible&&distance<16){const line=residentLine(p.gestureUntil,p.id);nameplate.say(line,t+Math.min(7500,Math.max(4500,line.length*65)));if(!readOnly&&audio?.state==='running')residentVoice.say(line,settings.volume*(1-distance/20),t,residentProfile(p.id).archetype);}
        }
        nameplate.render(camera,viewport.width,viewport.height,visible,Math.min(1,Math.max(0,(45-distance)/12)),t);
      }
      const distance=g.position.distanceTo(camera.position),animationInterval=distance>45?1000/15:distance>20?1000/30:0,animationElapsed=t-(g.userData.animatedAt??t-100);
      if(drawActor&&animationElapsed>=animationInterval){g.userData.human?.update({...p,crouching:p.crouching||p.treatment?.kind==='harvest',x:g.position.x,y:g.position.y,z:g.position.z,yaw:remote.yaw,pitch:remote.pitch},t,Math.min(.1,animationElapsed/1000),(snapshot?.now??0)+t-receivedAt);g.userData.animatedAt=t;}
    }
    contactShadows.end();
    battleAudio.listener();
    const underpass=island&&Math.abs(camera.position.x-islandUnderpass.x)<islandUnderpass.width/2
      &&Math.abs(camera.position.z-islandUnderpass.z)<islandUnderpass.depth/2;
    const covered=!!room||underpass||insideBuilding(world,camera.position.x,camera.position.z)>=0
      ||mapId==='frontline'&&Math.abs(camera.position.x-46)<9.3&&camera.position.z>-27&&camera.position.z<-24.4;
    if(island&&t-(lastAmbienceAt??-1000)>120){
      const {x,z}=camera.position;
      const coast=T.MathUtils.smoothstep(Math.hypot(x,z),63,107);
      const shelter=covered?1:T.MathUtils.smoothstep(z,68,88)*(x<-23?.63:.21);
      battleAudio.coastalAmbience(menu?0:coast*.25*settings.volume,shelter);
      lastAmbienceAt=t;
    }
    if(local){const step=advanceFootstep(stepPositions.get('local'),local,locked()&&snapshot?.phase==='playing');stepPositions.set('local',step.state);if(step.step)battleAudio.footstep(footstepMaterial(collisionWorld,local),undefined,.24*settings.volume,local.sprinting,local.crouching,false,covered);}
    const audioNow=(snapshot?.now??0)+t-receivedAt;
    const engines:{id:string;point:T.Vector3;active:boolean;muffled:boolean;carSpeed?:number}[]=[];
    if(snapshot?.phase==='playing'&&!snapshot.operation.paused){
      for(const player of [...snapshot.players,...snapshot.npcs]){
        if(!player.hp||player.weapon!==4||player.heldPart||player.carriedCorpse||!armCount(player)||player.id===myId&&car)continue;
        engines.push({id:player.id,point:player.id===myId?camera.position:new T.Vector3(player.x,player.y+1,player.z),active:player.id===myId?fire&&locked():player.fireAt>audioNow,muffled:audioMuffled(player)});
      }
      for(const remoteCar of snapshot.remoteCars??[]){
        const pose=operationScene.carPose(remoteCar.id);
        if(!remoteCar.driver||remoteCar.spent||remoteCar.detonateAt!==undefined||!pose)continue;
        engines.push({id:`rc-${remoteCar.id}`,point:pose.position,active:true,muffled:audioMuffled(pose.position),carSpeed:remoteCar.speed});
      }
    }
    battleAudio.engines(engines,settings.volume);
    flash.visible = false;
    const special=!!local?.heldPart||local?.treatment?.kind==='harvest';
    const saw=local?.weapon===4&&!special&&!local?.carriedCorpse;
    if(saw)aim=false;
    const hasDetailedWeapon=local?detailedWeapons.update(local.team,mapId,saw||special?4:local.weapon):false;
    if(catSilencer){
      catSilencer.visible=!special&&local?.weapon===2;
      if(catSilencer.visible)catSilencer.position.copy(detailedWeapons.muzzleLocal());
    }
    chainsaw.group.visible=saw;chainsaw.update(t,!!(saw&&fire&&locked()));
    const pose=local?viewmodel.update({dt,now:t,weaponIndex:local.weapon,aim,yaw,pitch,
      moving:locked()?Math.min(1,Math.hypot(Number(pressed('forward'))-Number(pressed('back')),Number(pressed('right'))-Number(pressed('left')))):0,
      sprinting:!!local.sprinting,grounded:local.grounded,
      reloadRemainingMs:Math.max(0,local.reloadAt-((snapshot?.now??0)+t-receivedAt)),
      reloadDurationMs:weapons[local.weapon].reload,muzzleY:detailedWeapons.muzzleLocal().y,sightY:detailedWeapons.sightY()}):undefined;
    detailedWeapons.animatePose(pose?.reloadProgress??0,pose?.aimBlend??0);
    const heldPart=local?.heldPart,heldHead=heldPart&&snapshot?.bodyParts.some(part=>part.id===heldPart&&part.part==='head');
    const hasFallbackHands=local?fallbackHands.update(special?heldHead?1:0:local.weapon,local.team,mapId,!hasDetailedWeapon&&!saw):false;
    fallbackHands.animatePose(pose?.reloadProgress??0,pose?.aimBlend??0);
    pistol.visible=!special&&!saw&&local?.weapon===1&&!hasDetailedWeapon;smg.visible=!special&&!saw&&local?.weapon===2&&!hasDetailedWeapon;for(const part of rifleParts)part.visible=!special&&!saw&&local?.weapon===0&&!hasDetailedWeapon;
    for(const h of weaponHands)h.visible=!saw&&local?.weapon!==1&&!hasDetailedWeapon&&!hasFallbackHands;sleeve.visible=!saw&&local?.weapon!==1&&!hasDetailedWeapon&&!hasFallbackHands;
    const renderNow=(snapshot?.now??0)+t-receivedAt,partThrown=local?remainsScene.threwPart(local.id,renderNow):false;
    const throwRemaining=(local?.throwAt??0)-renderNow;handStar.visible=!special&&!partThrown&&throwRemaining>610&&throwRemaining<=750;if(throwRemaining>0&&throwRemaining<=(partThrown?850:750)){weapon.rotation.x+=Math.sin(((partThrown?850:750)-throwRemaining)/(partThrown?850:750)*Math.PI)*.45;weapon.position.y-=Math.sin(((partThrown?850:750)-throwRemaining)/(partThrown?850:750)*Math.PI)*.12;}
    weapon.scale.x=local&&armCount(local)===1&&hasLost(local,'armR')?-1:1;
    weapon.visible = !car && !inspectionView && !!local?.hp && armCount(local)>0 && (!local.carriedCorpse||armCount(local)>1) && snapshot?.phase === "playing";
    const zoom=local?.weapon===G43_SCOPE_ID?4:local?.weapon===SNIPER_ID?3:1;
    const sniperAiming=weapon.visible&&zoom>1&&!special;
    const aimBlend=pose?.aimBlend??0;
    const scopeOpacity=sniperAiming?T.MathUtils.smoothstep(aimBlend,.66,.95):0;
    const scopeHidden=scopeOpacity===0;
    if(scope.hidden!==scopeHidden)scope.hidden=scopeHidden;
    if(!scopeHidden&&scope.style.opacity!==String(scopeOpacity))scope.style.opacity=String(scopeOpacity);
    if(scopeOpacity===1)weapon.visible=false;
    const scopedFov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(settings.fov/2))/zoom));
    const frameFov=inspectionView?50:T.MathUtils.lerp(settings.fov,zoom>1&&!special?scopedFov:settings.fov-24,aimBlend);
    if(camera.fov!==frameFov){camera.fov=frameFov;camera.updateProjectionMatrix();}
    const ammoDisplay=!car&&local?.hp&&snapshot?.phase==='playing'&&!saw&&!special?'block':'none';
    if(ammoReadout.style.display!==ammoDisplay)ammoReadout.style.display=ammoDisplay;
    if(local&&!saw&&!car){
      weapon.updateWorldMatrix(true,false);weapon.localToWorld(ammoAnchor.set(.34,-.15,-.52));
      const projected=projectWeaponMuzzle(ammoAnchor,camera,62-12*(pose?.aimBlend??0)).project(camera);
      const anchorX=Math.max(.56,Math.min(.91,(projected.x+1)/2))*viewport.width;
      ammoReadout.style.left=`${Math.max(12,Math.min(viewport.width-ammoWidth-16,anchorX+12))}px`;
      ammoReadout.style.top=`${Math.max(55,Math.min(81,(1-projected.y)*50))}%`;
      const count=String(local.ammo).padStart(2,'0'),reserve=` / ${weapons[local.weapon].mag} · ${local.reserve} Reserve`,status=local.reloadAt?'NACHLADEN …':local.ammo===0?`${settings.bindings.reload.replace('Key','')} NACHLADEN`:weapons[local.weapon].name.toUpperCase();
      if(ammoNumber.textContent!==count)ammoNumber.textContent=count;
      if(ammoReserve.textContent!==reserve)ammoReserve.textContent=reserve;
      if(ammoStatus.textContent!==status)ammoStatus.textContent=status;
      ammoReadout.classList.toggle('is-empty',local.ammo===0);
    }
    hitEffects.update(dt);muzzleEffects.update(dt);gore.update(dt);remainsScene.update(t,local,dt);
    if(!snapshot?.npcs)wanderers.update((snapshot?.now??0)+t-receivedAt,dt);
    const lightingPosition=carPose&&local?{...local,x:carPose.position.x,y:carPose.position.y,z:carPose.position.z}:local;
    interiors.update(lightingPosition??undefined,t,dt);
    const target=!car&&local?.hp&&locked()?(remainsScene.interaction(local,yaw)??operationScene.interaction(local,yaw)??interiors.interaction(local,yaw)??claims?.interaction(local,yaw)):undefined;
    let hint=target?`[${settings.bindings.interact.replace('Key','')}] ${('label' in target?target.label:interiors.label(target.id))}${'alternateLabel' in target&&target.alternateLabel?` · [${settings.bindings.sprint.replace('Left','').replace('Right','')}+${settings.bindings.interact.replace('Key','')}] ${target.alternateLabel}`:''}`:'';
    canvas.classList.toggle('city-driving',!!car);
    if(car){
      const key=(action:Action)=>settings.bindings[action].replace('Key','');
      const activeCourse=snapshot?.carCourse;
      const course=activeCourse?.carId===car.id?activeCourse:undefined;
      if(car.detonateAt!==undefined)hint='Achtung · Wagen zündet gleich';
      else if(course?.elapsedMs!==undefined){
        const seconds=(ms:number)=>(ms/1000).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});
        hint=`Ziel · ${seconds(course.elapsedMs)} s · Bestzeit ${seconds(course.bestMs??course.elapsedMs)} s · Linksklick Testzündung · [${key('interact')}] zurück`;
      }else{
        const stage=course?`Parcours ${course.next+1}/${course.gates.length} · Zum gelben Tor · `:'Rennwagen · ';
        hint=`${stage}${key('forward')}/${key('left')}/${key('back')}/${key('right')} fahren · Linksklick zünden · [${key('interact')}] zurück`;
      }
    }else if(!target&&local?.hp&&snapshot?.phase==='playing'&&snapshot.carCourse){
      const {carId}=snapshot.carCourse;
      const parked=snapshot.remoteCars?.find(vehicle=>vehicle.id===carId);
      if(parked&&!parked.driver&&parked.detonateAt===undefined){
        const distance=Math.round(Math.hypot(parked.x-local.x,parked.z-local.z));
        const building=world.buildings[Number(parked.id.slice(4))];
        if(building)hint=`Rennwagen-Parcours · Küstenstart · ${distance} m`;
      }
    }
    if(target?.id==='harbour-claims')hint=claims?.label(t)||hint;
    const hintDisplay=hint?'block':'none';
    if(interactionHint.style.display!==hintDisplay)interactionHint.style.display=hintDisplay;
    if(hint&&interactionHint.textContent!==hint)interactionHint.textContent=hint;
    const shop=room?.shop;
    const shopDepth=shop?shop.d/2-(eye.z-shop.z)*shop.front:0;
    const skyAccess=shop?1-.56*T.MathUtils.smoothstep(shopDepth,0,shop.d):covered?.38:1;
    const ambient=condition==='night'?.15:condition==='fog'?.90:daylight;
    const reflection=condition==='night'?.055:condition==='fog'?.32:island?.55:.48;
    const adapt=Math.min(1,dt*4);
    skyLight.intensity+=(ambient*skyAccess-skyLight.intensity)*adapt;
    scene.environmentIntensity+=(reflection*skyAccess-scene.environmentIntensity)*adapt;
    river?.update(t/1000);
    mapDetails.update(t/1000);
    environmentUpgrade.update(camera.position,quality);
    sceneAssets.updateCrates(camera,aimBlend>.04);
    graphics.render(dt,pose?.aimBlend??0,!menu,cpuTimes.at(-1),frameMs/1000,viewport,weapon.visible);
    const cpuMs=performance.now()-cpuStarted;
    cpuTimes.push(cpuMs);if(cpuTimes.length>180)cpuTimes.shift();
    if(frameProfile.length<profileLimit)frameProfile.push({frameMs,cpuMs,...graphics.frameState,steps,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,programs:renderer.info.programs?.length??0,detailDrawsSkipped});
    captureFrame?.();
    raf = requestAnimationFrame(frame);
  }
  let receivedAt = performance.now();
  raf = requestAnimationFrame(frame);
  return {
    setQuality(value:GraphicsQuality){quality=value;sceneAssets.setQuality(value);graphics.setQuality(value);},
    setSettings(value:GameSettings){settings=value;if(!value.volume)residentVoice.stop();if(audioOutput)audioOutput.gain.value=value.volume===0?0:1;release();},
    setEnabled(value:boolean){enabled=value;if(!value){residentVoice.stop();release();dragLook=false;if(document.pointerLockElement===canvas)document.exitPointerLock();}},
    startAudio,
    get worldPrepared(){
      return pendingActors.size?Promise.all([worldPrepared,...pendingActors]).then(()=>{}):worldPrepared;
    },
    setResolutionScaling:graphics.setResolutionScaling,
    capture(callback?:()=>void){captureFrame=callback;},
    profileFrames(limit=1200){frameProfile.length=0;profileLimit=Math.max(0,Math.min(3600,Math.floor(limit)));},
    frameProfile:()=>frameProfile,
    gpuTiming:graphics.setTimingEnabled,
    audioStream:()=>audioCapture?.stream,
    resetReplay(){seenEvents.clear();pending.length=0;gore.dispose();hitEffects.clear();battleAudio.clear();residentVoice.reset();stepPositions.clear();for(const g of avatars.values())delete g.userData.motion;},
    getRenderStats:()=>{const frames=[...frameTimes].sort((a,b)=>a-b),cpu=[...cpuTimes].sort((a,b)=>a-b);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frameP95:frames[Math.floor(frames.length*.95)]??0,frameMax:frames.at(-1)??0,cpuP95:cpu[Math.floor(cpu.length*.95)]??0,...hitEffects.stats(),...remainsScene.stats(),...worldWeaponStats(),...graphics.stats()};},
    update(s: Snapshot, id: string) {
      receivedAt = performance.now();
      update(s, id);
    },
    dispose() {
      stopped = true;
      contactShadows.dispose();
      residentVoice.dispose();
      hudResize.disconnect();wanderers.dispose();interiors.dispose();interactionHint.remove();
      ammoReadout.remove();scope.remove();
      claims?.dispose();disposeShopLights?.();mapDetails.dispose();disposeMilitaryRoofs?.();environmentUpgrade.dispose();
      hitEffects.dispose();gore.dispose();operationScene.dispose();remainsScene.dispose();muzzleEffects.dispose();
      cancelAnimationFrame(raf);
      listeners.forEach((f) => f());
      if (locked()) document.exitPointerLock();
      battleAudio.dispose();void audio?.close();
      fallbackHands.dispose();chainsaw.dispose();
      sceneAssets.dispose();
      for(const avatar of avatars.values()){avatar.userData.nameplate?.dispose();avatar.userData.details?.dispose();avatar.userData.anatomy?.dispose();avatar.userData.human?.dispose();}
      for(const root of [scene,camera])root.traverse((o) => {
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
      viewmodel.dispose();detailedWeapons.dispose();graphics.dispose();environment.dispose();materialLibrary.dispose();
      renderer.dispose();
      releaseWorldWeapons();
    },
  };
}
