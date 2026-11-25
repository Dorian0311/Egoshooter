import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {World} from '../shared/world';
import {terrainHeight} from '../shared/terrain';

type Point=[number,number,number];
/** East end of Harbour Road, looking toward the cranes. The signal arm uses the existing lamp pole;
 * the pilothouse, mooring tackle and raised quay sit outside the movement boundary. */
export function harbourEntrance(world:World,aggregate:T.Texture|null){
  const group=new T.Group(),parts:T.BufferGeometry[]=[];
  const iron='#4b5b59',cream='#e1d6af',teal='#4a6867',rust='#93745a',ochre='#bf994e';
  const tint=new T.Color(),up=new T.Vector3(0,1,0);
  function piece(g:T.BufferGeometry,tone:string,area=[.70,.09,.28,.26]){
    const uv=g.getAttribute('uv'),n=g.getAttribute('normal'),p=g.getAttribute('position'),rgb=new Float32Array(p.count*3);
    tint.set(tone);
    for(let i=0;i<p.count;i++){
      const grain=.95+.036*n.getY(i)+.019*Math.sin(1.7*p.getX(i)+.9*p.getZ(i));
      rgb[3*i]=tint.r*grain;rgb[3*i+1]=tint.g*grain;rgb[3*i+2]=tint.b*grain;
      uv.setXY(i,area[0]+uv.getX(i)*area[2],area[1]+uv.getY(i)*area[3]);
    }
    g.setAttribute('color',new T.BufferAttribute(rgb,3));
    const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();parts.push(flat);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,tone:string,rz=0){
    piece(new T.BoxGeometry(w,h,d).rotateZ(rz).translate(x,y,z),tone);
  }
  function beam(a:Point,b:Point,w:number,tone:string){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
    const g=new T.BoxGeometry(w,delta.length(),w);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,delta.normalize()));
    piece(g.translate(...start.lerp(end,.5).toArray()),tone);
  }
  function cylinder(x:number,y:number,z:number,top:number,bottom:number,h:number,tone:string){
    piece(new T.CylinderGeometry(top,bottom,h,12).translate(x,y,z),tone);
  }
  function westSign(x:number,y:number,z:number,w:number,h:number,area:number[]){
    piece(new T.PlaneGeometry(w,h).rotateY(-Math.PI/2).translate(x,y,z),'#ffffff',area);
  }
  // A riveted cantilever with a highway-scale enamel blade and twin hooded marker lamps.
  for(const x of [91.78,92.22]){
    beam([x,6.18,-29.2],[x,6.18,-19.65],.13,teal);
    beam([x,7.25,-29.2],[x,6.47,-19.65],.14,teal);
    for(let i=0;i<6;i++){
      const z=-29.2+i*1.55;
      beam([x,6.21,z],[x,7.12-i*.12,z+1.55],.075,iron);
    }
  }
  for(const h of [6.22,7.16])box(92,h,-29.2,.64,.21,.50,iron);
  for(const z of [-26.45,-20.42])beam([92,6.2,z],[92,5.75,z],.13,iron);
  box(92,5.22,-23.45,.20,1.83,6.65,iron);
  westSign(91.888,5.22,-23.45,6.52,1.78,[.002,.444,.996,.551]);
  for(const z of [-26.90,-20.0]){
    box(92,5.31,z,.42,.78,.36,iron);
    const lens=new T.CylinderGeometry(.118,.118,.035,14).rotateZ(Math.PI/2);
    piece(lens.translate(91.774,5.43,z),'#e6bc64');
    box(91.77,5.58,z,.26,.055,.32,teal);
  }
  // Tidal harbour office over the abutment, facing the approach.
  const cx=122.9,cz=-32.65;
  box(cx,-1.22,cz,6.25,1.65,7.70,'#929387');
  for(const z of [cz-2.95,cz+2.98])for(const x of [cx-2.77,cx+2.77]){
    cylinder(x,-2.74,z,.20,.24,2.4,iron);
  }
  box(cx,.85,cz,4.58,2.50,4.68,'#a49e85');
  for(let i=0;i<10;i++)box(cx-2.31,-.18+i*.113,cz,.055,.045,4.67,'#7c8275');
  box(cx,2.27,cz,4.60,.63,4.70,teal);
  for(const side of [-1,1]){
    const x=cx+side*2.32;
    box(x,1.48,cz,.065,1.28,4.45,'#364c50');
    for(let i=0;i<=4;i++)box(x+side*.04,1.48,cz-2.19+i*1.095,.09,1.36,.085,cream);
    box(cx,1.48,cz+side*2.37,4.45,1.28,.065,'#43585a');
    for(const dx of [-1.96,-.66,.66,1.96])box(cx+dx,1.48,cz+side*2.41,.07,1.36,.09,cream);
  }
  for(const y of [.82,2.13])box(cx,y,cz,4.80,.12,4.89,cream);
  box(cx,2.72,cz,5.46,.19,5.66,teal,-.105);
  for(let j=0;j<8;j++)box(cx,2.82,cz-2.6+j*.74,5.47,.035,.047,'#748681',-.105);
  westSign(cx-2.324,2.32,cz,3.22,.69,[.003,.101,.62,.295]);
  cylinder(cx+1.80,3.77,cz-.73,.041,.050,2.5,iron);
  beam([cx+1.8,4.87,cz-1.41],[cx+1.8,4.87,cz+.02],.046,iron);
  // Timber fendering, mooring bitts and a life ring belong to the quay rather than the road.
  for(let i=0;i<7;i++)box(cx-3.18,-1.86,cz-3.25+i*1.08,.20,2.8,.20,'#625d4e');
  for(const z of [cz-3.22,cz+3.25]){
    cylinder(cx-2.63,-.10,z,.20,.27,.59,iron);cylinder(cx-2.63,.23,z,.31,.30,.1,ochre);
  }
  const ringX=cx-2.43,ringZ=cz+1.53;
  for(let n=0;n<8;n++){
    const ring=new T.TorusGeometry(.28,.067,6,5,Math.PI/4);
    ring.rotateZ(n*Math.PI/4);ring.rotateY(-Math.PI/2);piece(ring.translate(ringX,.42,ringZ),n%2?'#c96845':cream);
  }
  const atlas=new T.TextureLoader().load('/shooter/island-street/port-authority.webp');
  atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
  const architecture=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
  const gate=new T.Mesh(architecture,new T.MeshStandardMaterial({vertexColors:true,map:atlas,roughness:.82,metalness:.11}));
  gate.name='East Harbour signal gantry and port office';gate.receiveShadow=true;group.add(gate);

  // Concrete slip apron follows the sand down to the tide. Each slab has its own joints, plus
  // recessed-looking transverse grooves where a vehicle would need purchase on a wet ramp.
  const pts:number[]=[],rgb:number[]=[],tex:number[]=[];
  function slab(x0:number,x1:number,z0:number,z1:number,lift:number,tone:string){
    tint.set(tone);
    for(const [x,z] of [[x0,z0],[x0,z1],[x1,z0],[x1,z0],[x0,z1],[x1,z1]]){
      pts.push(x,terrainHeight(x,z,world)+lift,z);rgb.push(tint.r,tint.g,tint.b);tex.push(x*.31,z*.31);
    }
  }
  for(let i=0;i<23;i++){
    const x=94.97+i*1.25;
    for(let lane=0;lane<3;lane++){
      const z=-27.47+lane*2.98,tone=['#b4b2a0','#bdb9a8','#aaa99d'][(i+lane*2)%3];
      slab(x,x+1.225,z,z+2.946,.060,tone);
      if(i>11)for(const offset of [.29,.67,1.05])slab(x+offset,x+offset+.053,z+.10,z+2.84,.072,'#8a8980');
    }
    if(i<13&&i%5<3)slab(x,x+1.21,-23.07,-22.95,.071,cream);
  }
  const surface=new T.BufferGeometry();surface.setAttribute('position',new T.Float32BufferAttribute(pts,3));
  surface.setAttribute('color',new T.Float32BufferAttribute(rgb,3));surface.setAttribute('uv',new T.Float32BufferAttribute(tex,2));surface.computeVertexNormals();
  const concrete=new T.MeshStandardMaterial({vertexColors:true,map:aggregate,roughness:.96});
  if(aggregate)concrete.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','diffuseColor.rgb*=.67+.60*texture2D(map,vMapUv).rgb;');};
  const slip=new T.Mesh(surface,concrete);slip.receiveShadow=true;slip.name='Concrete ferry slip at the end of Harbour Road';group.add(slip);
  return group;
}
