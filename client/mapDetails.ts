import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {Box,World} from '../shared/world';
import {batchStaticMeshes} from './scenery';
import {createIslandQuay} from './islandQuay';
import {createCoastalWater} from './coastalWater';
import {projectBoxUVs} from './materials';
import {islandCourseRadius,islandRoute,islandUnderpass,nearIslandRoute} from '../shared/islandRoute';
import {applySurfaceFinish} from './surfaceFinish';
import {terrainHeight} from '../shared/terrain';
import {texturedHeadland,islandHeadlands} from './coastalHeadland';
import {addIslandStreet} from './islandStreet';
import {inIslandStreet} from '../shared/islandStreet';
import {createBattleTerrain} from './battleTerrain';

export const detailedPropKinds=new Set(['sandbags','container','truck','ruin','tree','platform','coastal-portal','shop','street-pole']);

/** All substantial playable props follow shared collision boxes. Small dressing
 * stays below step height, on existing walls, or beyond the walking boundary. */
export function createMapDetails(scene:T.Scene,world:World,get:(color:string)=>T.MeshStandardMaterial,camera:T.Camera){
  const root=new T.Group();root.name='map-dressing-'+world.id;root.matrixAutoUpdate=false;scene.add(root);
  const island=world.id==='storm',war=world.id==='frontline';
  const colors=new Map<string,T.MeshStandardMaterial>();
  function material(color:string,metalness=0,roughness=.85){
    const key=color+':'+metalness+':'+roughness;
    let value=colors.get(key);if(!value){value=new T.MeshStandardMaterial({color,metalness,roughness});colors.set(key,value);}return value;
  }
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,parent:T.Object3D=root)=>{
    const breadth=Math.min(w,h,d);
    const geometry=breadth>=.4?new RoundedBoxGeometry(w,h,d,1,Math.min(breadth*.15,.18)):new T.BoxGeometry(w,h,d);projectBoxUVs(geometry,new T.Vector3(x,y,z),2.5);
    const mesh:T.Mesh<T.BufferGeometry,T.Material>=new T.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const cylinder=(x:number,y:number,z:number,r:number,h:number,mat:T.Material,segments=12)=>{
    const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const olive=material('#53654f',.18,.68),sand=material('#a59973'),rubber=material('#25292b',0,.94),steel=material('#515e62',.8,.35);
  function sandbags(b:Box){
    const rows=Math.max(2,Math.ceil(b.h/.27)),columns=Math.max(2,Math.ceil(b.w/.7));
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const bag=box(b.x-b.w/2+(col+.5)*b.w/columns,b.y-b.h/2+(row+.5)*b.h/rows,b.z+(row%2?.04:-.04),b.w/columns*.97,b.h/rows*.92,b.d,material(row%3?'#aaa17d':'#8b886d'));
      // Slightly rounded sacks read as stacked fabric, not a perfectly flat wall.
      const rounded=new T.CapsuleGeometry(b.h/rows*.45,Math.max(.02,b.w/columns-b.h/rows),4,8);
      bag.geometry.dispose();bag.geometry=rounded;bag.rotation.z=Math.PI/2;bag.scale.z=b.d/(b.h/rows*.9);
    }
  }
  function container(b:Box,index:number){
    const paint=material(index%2?'#476d79':'#9f694c',.45,.59);
    box(b.x,b.y,b.z,b.w,b.h,b.d,paint);
    for(const side of [-1,1]){
      for(let i=0;i<23;i++)box(b.x-b.w/2+(i+.5)*b.w/23,b.y,b.z+side*(b.d/2+.025),.065,b.h-.12,.05,paint);
      box(b.x,b.y-b.h/2+.08,b.z+side*(b.d/2+.04),b.w+.06,.13,.10,steel);
      box(b.x,b.y+b.h/2-.08,b.z+side*(b.d/2+.04),b.w+.06,.13,.10,steel);
      box(b.x+side*b.w/2,b.y,b.z,.08,b.h,.08,steel);
    }
    for(const z of [-.72,.72])box(b.x+b.w/2+.035,b.y,b.z+z,.06,b.h-.20,.045,steel);
    box(b.x,b.y+b.h/2+.025,b.z,b.w,.05,b.d,paint);
  }
  function truck(b:Box){
    box(b.x,b.y-.15,b.z,b.w*.82,b.h*.45,b.d*.94,olive);
    box(b.x-b.w*.31,b.y+.3,b.z,b.w*.30,b.h*.62,b.d*.91,olive);
    const glass=material('#264855',.3,.16);
    box(b.x-b.w*.31,b.y+.63,b.z,b.w*.28,.52,b.d*.94,glass);
    box(b.x+b.w*.14,b.y+.44,b.z,b.w*.55,.8,b.d*.98,material('#787f61'));
    for(const side of [-1,1])for(const x of [-b.w*.3,b.w*.28]){
      const wheel=cylinder(b.x+x,.55,b.z+side*b.d*.43,.55,.30,rubber,16);wheel.rotation.x=Math.PI/2;
      const hub=cylinder(b.x+x,.55,b.z+side*b.d*.51,.23,.32,steel);hub.rotation.x=Math.PI/2;
    }
    box(b.x-b.w*.48,.65,b.z,.13,.32,b.d,steel);
    for(const z of [-b.d*.33,b.d*.33]){const lamp=cylinder(b.x-b.w*.49,.97,b.z+z,.11,.09,material('#d8cfaa',.1,.25));lamp.rotation.z=Math.PI/2;}
  }
  function palm(b:Box,index:number){
    const trunk=cylinder(b.x,b.y,b.z,b.w/2,b.h,get('#67513d'),9);
    for(let ring=0;ring<12;ring++){
      const band=new T.Mesh(new T.TorusGeometry(b.w*.47,.018,4,9),material('#9b8d65'));band.rotation.x=Math.PI/2;band.position.set(b.x,b.h*(ring+.5)/12,b.z);root.add(band);
    }
    trunk.rotation.z=(index%2?1:-1)*.015;
    for(let frond=0;frond<9;frond++){
      const angle=frond*Math.PI*2/9+index*.3,positions:number[]=[],uv:number[]=[],indices:number[]=[];
      for(let n=0;n<=8;n++){
        const t=n/8,r=t*3.7,width=Math.sin(Math.PI*t)*.48;
        for(const side of [-1,1]){
          positions.push(Math.cos(angle)*r+Math.sin(angle)*width*side,b.h+.8*Math.sin(t*Math.PI)-t*t*1.5,Math.sin(angle)*r-Math.cos(angle)*width*side);uv.push(t,(side+1)/2);
        }
        if(n<8){const k=n*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
      const leaf=material(frond%3?'#427a3b':'#689d47');leaf.side=T.DoubleSide;
      const mesh=new T.Mesh(geometry,leaf);mesh.position.set(b.x,0,b.z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    }
  }
  let radarRotor:T.Group|undefined;
  for(const [index,b]of world.boxes.entries()){
    if(b.kind==='sandbags')sandbags(b);
    if(b.kind==='container')container(b,index);
    if(b.kind==='truck')truck(b);
    if(b.kind==='tree')palm(b,index);
    if(b.kind==='coastal-portal'){
      box(b.x,b.y,b.z,b.w,b.h,b.d,material('#777b68',.05,.91));
      if(b.w>3){
        const danger=material('#d69e46',.07,.78),shade=material('#564631');
        for(const side of [-1,1]){
          for(let stripe=0;stripe<22;stripe++){
            const trim=box(b.x+(stripe-10.5)*.32,b.y,b.z+side*(b.d/2+.024),.19,.36,.04,stripe%2?danger:shade);
            trim.rotation.z=-.34;
          }
          box(b.x,b.y-.39,b.z+side*1.4,2.7,.075,.18,material('#e8d493')).castShadow=false;
        }
      }
    }
    if(b.kind==='platform'){
      const teal=material('#286d70',.35,.55),enamel=material('#e5d9b1',.18,.64);
      box(b.x,b.y,b.z,b.w,b.h,b.d,enamel);
      for(const side of [-1,1]){
        const x=b.x+side*(b.w/2+.045),z=b.z+side*(b.d/2+.045);
        box(x,b.y-.65,b.z,.09,.54,b.d,teal);
        box(b.x,b.y-.65,z,b.w,.54,.09,teal);
        box(x,b.y+.60,b.z,.10,.08,b.d,teal);
        box(b.x,b.y+.60,z,b.w,.08,.10,teal);
        for(const offset of [-.28,.28]){
          const center=b.z+offset*b.d;
          box(x+side*.05,b.y,center,.11,1.1,1.8,steel);
          for(let slat=0;slat<6;slat++)
            box(x+side*.12,b.y-.43+slat*.17,center,.09,.065,1.58,enamel);
        }
      }
      for(const side of [-1,1])box(b.x,b.y+b.h/2-.08,b.z+side*b.d/2,b.w+.2,.16,.25,olive);
      cylinder(0,5.5,0,.13,5,steel);
      const pedestal=material('#437b7e',.48,.44);
      const beacon=new T.MeshStandardMaterial({color:'#f2bc5b',emissive:'#ec8126',emissiveIntensity:.65,roughness:.42});
      colors.set('radar-beacon',beacon);
      for(const side of [-1,1]){
        // Low curved service housings flank the mast while the stairs stay clear.
        const housing=new T.Mesh(new T.CapsuleGeometry(.58,2.1,5,14),teal);
        housing.rotation.z=Math.PI/2;
        housing.position.set(b.x+side*4.45,3.57,b.z+1.83);
        housing.castShadow=housing.receiveShadow=true;root.add(housing);
        cylinder(b.x+side*5.36,4.25,b.z+1.83,.15,.20,steel,12);
        cylinder(b.x+side*5.36,4.39,b.z+1.83,.11,.14,beacon,12).castShadow=false;
      }
      cylinder(b.x,3.12,b.z,.94,.24,steel,24);
      cylinder(b.x,3.68,b.z,.56,1.02,pedestal,24);
      cylinder(b.x,4.24,b.z,.72,.20,steel,24);
      radarRotor=new T.Group();radarRotor.position.set(b.x,7.6,b.z);root.add(radarRotor);
      const radar=new T.Group();radar.rotation.z=-.55;radarRotor.add(radar);
      const dishMaterial=material('#c9d4c9',.55,.4);dishMaterial.side=T.DoubleSide;
      const profile=Array.from({length:15},(_,i)=>new T.Vector2(i/14*1.7,Math.pow(i/14,2)*.55));
      const dish=new T.Mesh(new T.LatheGeometry(profile,40),dishMaterial);dish.castShadow=true;radar.add(dish);
      const rim=new T.Mesh(new T.TorusGeometry(1.7,.035,6,40),steel);rim.rotation.x=Math.PI/2;rim.position.y=.55;radar.add(rim);
      const feed=new T.Mesh(new T.CylinderGeometry(.1,.08,.35,10),steel);feed.position.y=1.15;radar.add(feed);
      for(let n=0;n<3;n++){
        const angle=n*Math.PI*2/3,start=new T.Vector3(Math.cos(angle)*1.65,.55,Math.sin(angle)*1.65),end=new T.Vector3(0,1.15,0),direction=end.clone().sub(start);
        const brace=new T.Mesh(new T.CylinderGeometry(.025,.025,direction.length(),6),steel);brace.position.copy(start).add(end).multiplyScalar(.5);brace.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());radar.add(brace);
      }
      box(0,3.2,0,1,.4,1,olive);
      for(const side of [-1,1]){
        const panel=box(side*3.2,3.85,-3,2.6,.12,1.8,material('#263f58',.4,.26));panel.rotation.x=-.25;
        for(let n=0;n<7;n++)box(side*3.2-1.1+n*.35,3.94,-3,.025,.025,1.65,material('#87969f',.6,.35));
      }
      for(const x of [-1.6,1.6])box(x,3.8,1.5,.9,1.6,.7,olive);
    }
    if(b.kind==='ruin'){
      box(b.x,b.y,b.z,b.w,b.h,b.d,get('#c1b59a'));
      for(let n=0;n<7;n++){const chunk=box(b.x-b.w/2+(n+.5)*b.w/7,b.y+b.h/2+(n%3)*.11,b.z,.55,.25+(n%3)*.12,b.d*.9,get('#9d8b75'));chunk.rotation.z=(n%2?.1:-.1);}
    }
    if(war&&b.kind==='wagon'){
      // Existing shared body collider remains the full extent of the rail car.
      for(const side of [-1,1])for(const x of [-3.7,3.7]){const wheel=cylinder(b.x+x,.45,b.z+side*1.30,.5,.22,steel,16);wheel.rotation.x=Math.PI/2;}
      const frame=material('#343d3b',.52,.62),boards=[material('#6d4634',.03,.94),material('#80553d',.03,.94),material('#67432f',.03,.94)];
      for(const side of [-1,1]){
        const z=b.z+side*(b.d/2+.029);
        for(let i=0;i<24;i++)
          box(b.x-b.w/2+(i+.5)*b.w/24,b.y+.10,z,b.w/24-.012,b.h-.50,.065,boards[(i*7+Math.floor(i/4))%3]);
        for(const y of [.37,2.74])box(b.x,y,z+side*.05,b.w,.13,.12,frame);
        for(const offset of [-1.42,1.42]){
          box(b.x+offset,1.56,z+side*.07,.11,2.12,.11,frame);
          const brace=box(b.x+offset*2.05,1.55,z+side*.055,.13,2.58,.1,frame);
          brace.rotation.z=offset<0?-.57:.57;
        }
        box(b.x+.91,1.39,z+side*.10,.23,.1,.10,frame);
        box(b.x-3.62,1.91,z+side*.064,.86,.36,.023,material('#312f29')).castShadow=false;
      }
      box(b.x,2.87,b.z,b.w+.16,.19,b.d+.17,frame);
      for(const side of [-1,1])box(b.x+side*(b.w/2+.09),.64,b.z,.25,.23,.22,frame);
      for(const x of [-4.8,4.8])box(b.x+x,b.y,b.z+b.d/2+.05,.1,b.h,.08,steel);
    }
  }
  let ocean:ReturnType<typeof createCoastalWater>|undefined;
  const terrain=island||war?createBattleTerrain(world,get(island?'#718a48':'#77766b'),get('#d0b37c')):undefined;
  if(terrain)root.add(terrain.mesh);
  const roadTextures:T.Texture[]=[];
  let roadSurface:T.MeshStandardMaterial|undefined;
  const disposeStreet=island?addIslandStreet(root):undefined;
  if(island){
    root.add(createIslandQuay());
    ocean=createCoastalWater(scene,world);
    const route=new T.CatmullRomCurve3(islandRoute.map(([x,z])=>new T.Vector3(x,0,z)));
    const loader=new T.TextureLoader();
    const roadMap=loader.load('/shooter/island-street/asphalt-color.webp');
    const roadNormal=loader.load('/shooter/island-street/asphalt-normalgl.webp');
    roadMap.colorSpace=T.SRGBColorSpace;
    for(const tex of [roadMap,roadNormal]){
      tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;roadTextures.push(tex);
    }
    const road=new T.MeshStandardMaterial({map:roadMap,normalMap:roadNormal,vertexColors:true,roughness:.95});
    roadSurface=road;road.normalScale.set(.48,.48);
    const asphalt=new T.Color('#f1eee5'),verge=new T.Color('#ccae83'),marking=material('#edd8a3');
    const center=new T.Vector3(),tangent=new T.Vector3(),roadColor=new T.Color(),routeLength=route.getLength();
    // Weld the verge to the surrounding ground with opaque gravel and broken paving.
    // Coverage is evaluated in road metres, so the edge stays fixed as the camera turns.
    const shoulder=get('#d0b37c');
    road.onBeforeCompile=shader=>{
      shader.uniforms.vergeSand={value:shoulder.map};
      shader.uniforms.roadLength={value:routeLength};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRoadPoint;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadPoint=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying vec3 vRoadPoint; uniform sampler2D vergeSand; uniform float roadLength;')
        .replace('#include <map_fragment>',`#include <map_fragment>
          vec2 roadMetres=vMapUv*3.2;
          float edgeDistance=min(2.65-abs(roadMetres.x),min(roadMetres.y,roadLength-roadMetres.y)*.28);
          vec3 sandSample=texture2D(vergeSand,vRoadPoint.xz/6.0).rgb;
          float grain=clamp(dot(sandSample,vec3(.31,.50,.19))*2.2,0.,1.);
          float edge=smoothstep(.02,.7,edgeDistance+(grain-.5)*.9+
            .10*sin(roadMetres.y*3.8)+.05*sin(roadMetres.y*11.1));
          diffuseColor.rgb=mix(sandSample*vec3(1.02,.97,.87),diffuseColor.rgb,edge);`);
    };
    road.customProgramCacheKey=()=>'coastal-road-verge-v1';
    // Tyre wear is part of the road mesh, so even the sweeping bend needs
    // just one material and no stacked transparent decals.
    const offsets=[-2.65,-1.83,-.99,-.76,-.52,.52,.76,.99,1.83,2.65];
    // Short terrain-following ribbons batch by cell and keep the path free of obstacles.
    for(let section=0;section<12;section++){
      const positions:number[]=[],indices:number[]=[],colors:number[]=[],uv:number[]=[];

      for(let i=0;i<=8;i++){
        const progress=(section+i/8)/12;
        route.getPointAt(progress,center);route.getTangentAt(progress,tangent);
        for(const [col,offset] of offsets.entries()){
          const x=center.x+tangent.z*offset,z=center.z-tangent.x*offset;
          positions.push(x,terrainHeight(x,z,world)+.043,z);
          uv.push(offset/3.2,progress*routeLength/3.2);
          const edge=col===0||col===offsets.length-1;
          const wear=(col===3||col===6)?(.11+.10*Math.sin(progress*93)**2):0;
          const mix=(1-wear)*(.96+.07*Math.sin(progress*119+offset*1.7)*Math.cos(progress*73+col*.61));
          roadColor.copy(edge?verge:asphalt).multiplyScalar(mix).toArray(colors,colors.length);
        }
        if(i)for(let col=0;col<offsets.length-1;col++){
          const a=(i-1)*offsets.length+col,b=a+offsets.length;
          indices.push(a,b,a+1,a+1,b,b+1);
        }
      }
      const surface=new T.BufferGeometry();
      surface.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      surface.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      surface.setIndex(indices);surface.computeVertexNormals();
      surface.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      const strip=new T.Mesh(surface,road);strip.receiveShadow=true;root.add(strip);
    }
    for(let i=1;i<32;i++){
      const progress=i/32;
      route.getPointAt(progress,center);route.getTangentAt(progress,tangent);
      const stripe=box(center.x,terrainHeight(center.x,center.z,world)+.07,center.z,.09,.018,.95,marking);
      stripe.rotation.y=Math.atan2(tangent.x,tangent.z);stripe.castShadow=false;
    }
    {
      const chalk=material('#efcc78',0,1),white=material('#f2e8d3',0,1);
      for(const [index,[x,z]] of islandRoute.slice(1).entries()){
        const y=terrainHeight(x,z,world),gate={x,y:y+.057,z};
        const [previousX,previousZ]=islandRoute[index],[nextX,nextZ]=islandRoute[Math.min(index+2,islandRoute.length-1)];
        const angle=Math.atan2(nextX-previousX,nextZ-previousZ);
        const acrossX=Math.cos(angle),acrossZ=-Math.sin(angle);
        for(const side of [-1,1])
          {
            const mark=box(gate.x+side*islandCourseRadius*acrossX,gate.y+.021,gate.z+side*islandCourseRadius*acrossZ,.14,.018,1.06,chalk);
            mark.rotation.y=angle;mark.castShadow=false;
          }
        for(let tile=-4;tile<=4;tile++)
          {
            const mark=box(gate.x+tile*.27*acrossX,gate.y+.021,gate.z+tile*.27*acrossZ,.21,.018,.27,(tile+index)%2===0?white:chalk);
            mark.rotation.y=angle;mark.castShadow=false;
          }
      }
    }
    const cliffMaterial=get('#858a79');
    for(const [i,[x,z,width,height,depth]] of islandHeadlands.entries()){
      const cliff=new T.Mesh(texturedHeadland(i),cliffMaterial);
      cliff.position.set(x,-4,z);cliff.scale.set(width,height,depth);
      cliff.rotation.y=i*.87;root.add(cliff);
    }
    // The lighthouse sits on the tallest western headland, above the sea haze.
    const beaconX=-183,beaconZ=-64,base=42;
    for(let band=0;band<4;band++)
      cylinder(beaconX,base+2+band*4,beaconZ,2.8-band*.29,4.05,material(band%2?'#b95c48':'#eee6ca'),20);
    cylinder(beaconX,base+16.2,beaconZ,2.5,.45,steel,20);
    cylinder(beaconX,base+17.2,beaconZ,1.55,1.65,material('#ffe5ad',.2,.25),16);
    cylinder(beaconX,base+18.3,beaconZ,2.1,.55,steel,20);

    // Each tuft shares one bent-leaf mesh. Place patches in grass beside the
    // sand paths, keeping the road surface and the interiors clear.
    const blades:number[]=[];
    for(let blade=0;blade<10;blade++){
      const angle=blade*2.4,r=.22*Math.sqrt(blade/10),x=r*Math.cos(angle),z=r*Math.sin(angle);
      const dx=.026*Math.sin(angle),dz=-.026*Math.cos(angle),h=.18+.12*(blade%3);
      const midX=x*1.25,midZ=z*1.25;
      blades.push(x-dx,0,z-dz,x+dx,0,z+dz,midX-dx,h*.58,midZ-dz,
        x+dx,0,z+dz,midX+dx,h*.58,midZ+dz,midX-dx,h*.58,midZ-dz,
        midX-dx,h*.58,midZ-dz,midX+dx,h*.58,midZ+dz,x*1.8,h,z*1.8);
    }
    const tuft=new T.BufferGeometry();tuft.setAttribute('position',new T.Float32BufferAttribute(blades,3));tuft.computeVertexNormals();
    const greenery=material('#ffffff',0,.99);greenery.side=T.DoubleSide;
    const grass=new T.InstancedMesh(tuft,greenery,1600),pose=new T.Object3D(),tint=new T.Color();
    let count=0;
    const fraction=(n:number)=>n-Math.floor(n);
    for(let n=0;n<1600;n++){
      const x=(fraction(Math.sin(n*17.13+1)*43758.5)-.5)*206,z=(fraction(Math.sin(n*79.2+3)*31843.7)-.5)*206;
      const road=Math.min(Math.abs(x),Math.abs(z),Math.abs(Math.abs(x)-43));
      if(road<4.4||inIslandStreet(x,z)||nearIslandRoute(x,z,3)||Math.hypot(x,z)>100||world.buildings.some(b=>Math.abs(b.x-x)<b.w/2+.5&&Math.abs(b.z-z)<b.d/2+.5))continue;
      pose.position.set(x,terrainHeight(x,z,world)-.018,z);pose.rotation.y=n*2.4;
      pose.scale.setScalar(.65+fraction(n*.618)*.7);pose.updateMatrix();
      grass.setMatrixAt(count,pose.matrix);grass.setColorAt(count++,tint.set(n%3?'#719448':'#a3ae59'));
    }
    grass.count=count;grass.receiveShadow=true;root.add(grass);

  }
  if(war){
    // Workers' terraces and pitched roofs extend the freight yard
    // beyond the walking boundary. The foreground tracks lead into the town.
    const masonry=material('#876f60'),slate=material('#4e5759'),window=material('#434846');
    for(const side of [-1,1])for(let block=0;block<12;block++){
      const x=(block-5.5)*22,z=side*(142+(block%3)*4),h=8+(block*7%5)*1.25;
      box(x,h/2-.5,z,20,h+1,14,masonry);
      const shape=new T.Shape();
      shape.moveTo(-10.5,0);shape.lineTo(0,3.3);shape.lineTo(10.5,0);shape.closePath();
      const roof=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:15,bevelEnabled:false}),slate);
      roof.position.set(x,h,z-7.5);root.add(roof);
      box(x+6,h+2,z-2,1.2,4.6,1.3,masonry);
      for(let n=0;n<5;n++)for(let floor=0;floor<3;floor++)
        box(x-8+n*4,1.5+floor*3,z-side*7.04,1.35,1.85,.12,window);
    }
    const station=world.buildings.find(b=>b.name==='GÜTERBAHNHOF');
    if(station){
      const brick=material('#7b4737',.02,.9),iron=material('#384242',.66,.56);
      const roof=material('#466360',.45,.6),lamp=material('#f3d794',.10,.45);
      const {x,z,w,d}=station,front=z+d/2;
      // The canopy is above head height. Its wall brackets leave both doors
      // and the full length of the freight quay open to the player.
      box(x,3.32,front+1.14,w+.38,.15,2.65,roof);
      box(x,3.27,front+2.43,w+.43,.23,.13,iron);
      for(const offset of [-7,-3.6,3.6,7]){
        box(x+offset,2.87,front+.32,.24,.98,.18,brick);
        const brace=box(x+offset,3.02,front+1.05,.12,.11,1.69,iron);
        brace.rotation.x=.32;
        box(x+offset,3.13,front+1.26,.24,.15,.35,lamp).castShadow=false;
      }
      applySurfaceFinish(brick,true);
      const worn=material('#837564',.03,.98),yardTimber=material('#63503b',.02,.92);
      for(let row=0;row<4;row++){
        for(let column=0;column<7;column++){
          const offset=2.25+column*.55+(row%2)*.25;
          const patch=box(x-offset,.47+row*.21,front+.245,.51,.17,.025,row%3===0?worn:brick);
          patch.castShadow=false;
        }
      }
      for(let plank=0;plank<12;plank++){
        const height=.025+plank*.005;
        box(52.8+plank*.12,height/2,-24.2,.119,height,1.35,yardTimber).castShadow=false;
      }
      for(const offset of [2.7,3.5,4.4]){
        box(x+offset,.026,front+2.70,.47,.047,.061,worn).castShadow=false;
      }
      for(const rail of [-.72,.72])box(61,.035,-22+rail,30,.065,.075,iron);
      for(let tie=0;tie<22;tie++)box(46+tie*1.35,.017,-22,.17,.031,2.1,get('#67513d'));
      // A raised loading shutter rides inside the existing doorway lintel.
      for(let slat=0;slat<6;slat++)
        box(x,2.85+slat*.065,front+.149,3.8,.058,.12,iron);
      for(const side of [-1,1])box(x+side*1.96,1.45,front+.12,.085,2.9,.16,iron);
      // Signal mast and raised freight doors sit against the existing facade.
      const signal=cylinder(x+12,1.72,front+2.83,.08,3.4,iron,10);
      signal.castShadow=false;
      box(x+12,3.42,front+2.83,.46,.56,.22,iron);
      box(x+12,3.42,front+2.97,.19,.19,.075,material('#96453a')).castShadow=false;
      for(const side of [-1,1]){
        box(x+side*5.3,.044,front+1.21,6.4,.08,2.75,get('#9d8b75'));
        box(x+side*5.3,.085,front+2.56,6.35,.018,.095,brick);
        for(let joint=0;joint<8;joint++)
          box(x+side*5.3-2.8+joint*.8,.086,front+1.21,.024,.015,2.68,iron).castShadow=false;
      }
    }
    // Twin rail lines, sleepers and broken paving give the courtyard a clear use.
    for(const z of [-12,12]){
      for(const offset of [-.8,.8])box(0,.055,z+offset,234,.11,.09,steel);
      for(let x=-116;x<=116;x+=1.4)box(x,.018,z,.22,.036,2.5,get('#67513d'));
    }
    for(const side of [-1,1])for(const z of [-31,-25]){
      // Chimneys sit on the now-accessible machine halls.
      cylinder(side*92,19,z,1.3,26,get('#9d8b75'),14);
      cylinder(side*92,32,z,1.5,.5,steel,14);
    }
  }
  // Ground-level chips and sparse weeds: deterministic, batched, no gameplay
  // obstacles. Keep door openings and the bridge's water entirely clear.
  for(const [index,b]of world.buildings.entries())for(const side of [-1,1]){
    for(let n=0;n<(island?10:28);n++){
      const x=b.x+Math.sin(n*13.71+index)*b.w*.48;
      if(Math.abs(x-b.x)<2.7)continue;
      const z=b.z+side*(b.d/2+.45+(n%4)*.28);
      const chip=box(x,.035+(n%3)*.018,z,.09+(n%4)*.09,.07+(n%3)*.036,.12+(n%5)*.07,get(n%3?'#9d8b75':'#c1b59a'));
      chip.rotation.y=n*1.9;chip.rotation.z=(n%3)*.1;
      if(n%5===0){const weed=new T.Mesh(new T.ConeGeometry(.14,.32,5),material('#5b6b42'));weed.position.set(x,.16,z);root.add(weed);}
    }
    // Cables, drainpipes and wall-mounted lamps break up large flat facades.
    for(const dx of [-b.w/2+.55,b.w/2-.55]){
      cylinder(b.x+dx,(b.upper?8:4)/2,b.z+side*(b.d/2+.31),.055,b.upper?8:4,steel,7);
    }
    const lamp=box(b.x+2.7,2.8,b.z+side*(b.d/2+.43),.24,.35,.18,steel);
    box(lamp.position.x,2.77,lamp.position.z+side*.10,.17,.21,.025,material('#cfbb82',.1,.35));
  }
  // Low kerbs establish street edges without introducing invisible collisions.
  if(!island)for(const b of world.buildings)for(const side of [-1,1])box(b.x,.055,b.z+side*(b.d/2+1.6),b.w+1,.11,.35,get('#9d8b75'));
  // Only plain uniform colours can share vertex tint. Patinated station masonry has its own shader.
  const tintable=new Set([...colors.values()].filter(m=>m.onBeforeCompile===T.Material.prototype.onBeforeCompile&&
    !Object.values(m).some(value=>value instanceof T.Texture)));
  batchStaticMeshes(root,new Set(),64,tintable);
  return {update(seconds:number){ocean?.update(seconds);if(radarRotor)radarRotor.rotation.y=seconds*.25;},dispose(){ocean?.dispose();disposeStreet?.();roadSurface?.dispose();roadTextures.forEach(texture=>texture.dispose());terrain?.dispose();colors.forEach(m=>m.dispose());}};
}
