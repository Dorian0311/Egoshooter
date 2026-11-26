import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Box} from '../shared/world';

type Point=[number,number,number];
const atlasPanels={deck:[1,1,1022,1022],wall:[1026,2,508,211],metal:[1026,224,508,216],
  sign:[1030,454,499,142],solar:[1030,606,499,198],rack:[1030,817,499,196]} as const;
type Panel=keyof typeof atlasPanels;

/** Both stairways meet the painted east–west approach. All service equipment stays in the old platform envelope. */
export function coastalRadar(b:Box){
  const root=new T.Group(),rotor=new T.Group();root.name='Island coastal radar';root.position.set(b.x,b.y-b.h/2,b.z);
  rotor.position.y=7.60;root.add(rotor);
  const color=new T.Color(),steel='#596966',teal='#66837c',galvanized='#aeb5a8',dark='#45504c';
  const staticParts:T.BufferGeometry[]=[],movingParts:T.BufferGeometry[]=[];
  let output=staticParts;
  function add(g:T.BufferGeometry,c:string,panel:Panel='metal',signal=false){
    const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
    const rgb=new Float32Array(p.count*3),lamp=new Float32Array(p.count);
    color.set(c);
    for(let i=0;i<p.count;i++){
      const tile=panel==='wall'&&n.getY(i)>.9?'deck':panel;
      const [x,y,w,h]=atlasPanels[tile],wear=.96+.04*n.getY(i);
      rgb[i*3]=color.r*wear;rgb[i*3+1]=color.g*wear;rgb[i*3+2]=color.b*wear;
      uv.setXY(i,(x+uv.getX(i)*w)/1536,1-(y+(1-uv.getY(i))*h)/1024);
      if(signal)lamp[i]=1;
    }
    g.setAttribute('color',new T.BufferAttribute(rgb,3));g.setAttribute('beaconLens',new T.BufferAttribute(lamp,1));
    if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}output.push(g);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,panel:Panel='metal',rx=0){
    add(new T.BoxGeometry(w,h,d).rotateX(rx).translate(x,y,z),c,panel);
  }
  function cylinder(x:number,y:number,z:number,rt:number,rb:number,h:number,c:string,signal=false){
    add(new T.CylinderGeometry(rt,rb,h,16).translate(x,y,z),c,'metal',signal);
  }
  function beam(a:Point,b:Point,w:number,c:string){
    const start=new T.Vector3(...a),dir=new T.Vector3(...b).sub(start),g=new T.BoxGeometry(w,dir.length(),w);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().normalize()));
    start.addScaledVector(dir,.5);add(g.translate(start.x,start.y,start.z),c);
  }
  box(0,b.h/2,0,b.w,b.h,b.d,'#edece3','wall');
  for(const side of [-1,1]){
    box(0,2.91,side*9.015,18.0,.15,.16,steel);
    for(const z of [-5.65,5.65]){
      const x=side*9.065;
      box(x,1.65,z,.14,1.26,2.81,steel);
      const sign=z===-5.65;
      const plane=new T.PlaneGeometry(2.58,sign?.77:1.10).rotateY(side*Math.PI/2).translate(x+side*.077,1.67,z);
      add(plane,'#ffffff',sign?'sign':'rack');
    }
    // Compressor housings, isolated on plinths, and the existing amber obstruction beacons.
    box(side*4.45,3.12,1.83,3.40,.22,1.10,dark);
    const housing=new T.CapsuleGeometry(.54,2.02,4,12).rotateZ(Math.PI/2).translate(side*4.45,3.64,1.83);
    add(housing,teal);
    for(const dx of [-.78,.78])add(new T.TorusGeometry(.548,.045,5,14).rotateY(Math.PI/2).translate(side*4.45+dx,3.64,1.83),steel);
    cylinder(side*5.31,4.24,1.83,.14,.17,.18,dark);
    cylinder(side*5.31,4.38,1.83,.115,.12,.15,'#efb95b',true);
    // The tilted PV modules and cable conduits use the previous panel footprints.
    const px=side*3.20;
    for(const dz of [-.62,.62])box(px,3.28,-3+dz,1.93,dz<0?.64:.39,.14,galvanized);
    box(px,3.85,-3,2.6,.13,1.8,galvanized,'metal',-.25);
    add(new T.PlaneGeometry(2.48,1.69).rotateX(-Math.PI/2-.25).translate(px,3.93,-3.02),'#d7dfe1','solar');
    box(side*1.6,3.79,1.5,.91,1.58,.70,teal);
    add(new T.PlaneGeometry(.83,1.14).translate(side*1.60,3.88,1.857),'#dee1d3','rack');
    box(side*1.04,3.057,-1.33,1.98,.087,.18,steel);box(side*2.0,3.057,-2.17,.18,.087,1.82,steel);
  }
  // Tapered braced mast, rotary bearing and service feeder, within the central pedestal.
  cylinder(0,3.17,0,.83,.95,.34,steel);cylinder(0,3.68,0,.55,.67,.71,teal);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    beam([sx*.49,4.02,sz*.49],[sx*.26,7.43,sz*.26],.11,galvanized);
    for(let k=0;k<3;k++){
      const h=4.12+k*1.0,w=.46-k*.063;
      beam([sx*w,h,sz*w],[-sx*(w-.06),h+.92,sz*(w-.06)],.049,steel);
      beam([sx*w,h,sz*w],[sx*(w-.06),h+.92,-sz*(w-.06)],.049,steel);
    }
  }
  cylinder(0,5.83,0,.096,.14,3.59,dark);cylinder(0,7.41,0,.46,.41,.27,teal);
  output=movingParts;
  // Shallow coastal surveillance dish scans near the horizon. Back ribs remain attached through each revolution.
  const radius=2.04;
  const curve=(r:number)=>.56*(r/radius)**2;
  const profile:T.Vector2[]=[];
  for(let i=0;i<=7;i++){const r=radius*i/7;profile.push(new T.Vector2(r,curve(r)-.065));}
  for(let i=7;i>=0;i--){const r=radius*i/7;profile.push(new T.Vector2(r,curve(r)));}
  add(new T.LatheGeometry(profile,32),'#d4d9c8');
  add(new T.TorusGeometry(radius,.046,5,32).rotateX(Math.PI/2).translate(0,.54,0),steel);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,point=(r:number,dy:number):Point=>[Math.cos(a)*r,curve(r)+dy,Math.sin(a)*r];
    beam(point(.28,-.16),point(1.12,-.14),.072,steel);beam(point(1.12,-.14),point(1.96,-.052),.063,steel);
    if(i%2===0)beam(point(1.93,.016),[0,1.1,0],.043,galvanized);
  }
  cylinder(0,1.15,0,.13,.12,.32,dark);
  const atlas=new T.TextureLoader().load('/shooter/environment/coastal-radar.webp');
  atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
  const material=new T.MeshStandardMaterial({map:atlas,vertexColors:true,roughness:.82,metalness:.12});
  material.onBeforeCompile=s=>{
    s.vertexShader='attribute float beaconLens; varying float vRadarBeacon;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRadarBeacon=beaconLens;');
    s.fragmentShader='varying float vRadarBeacon;\n'+s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vRadarBeacon*vec3(.64,.23,.018);');
  };
  for(const parts of [staticParts,movingParts]){
    const g=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());const mesh=new T.Mesh(g,material);
    mesh.castShadow=true;mesh.receiveShadow=true;
    if(parts===movingParts){mesh.rotation.z=-1.27;rotor.add(mesh);}else root.add(mesh);
  }
  return {root,rotor};
}
