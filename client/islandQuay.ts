import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The working quay sits across the channel, beyond the Island movement boundary. */
export function createIslandQuay(){
  const pieces:T.BufferGeometry[]=[];
  const paint=new T.Color(),matrix=new T.Matrix4(),rotation=new T.Quaternion(),up=new T.Vector3(0,1,0);
  function finish(g:T.BufferGeometry,color:string){
    const pos=g.getAttribute('position'),norm=g.getAttribute('normal'),rgb=new Float32Array(pos.count*3);
    paint.set(color);
    for(let i=0;i<pos.count;i++){
      const wear=.94+.045*norm.getY(i)+.025*Math.sin(pos.getX(i)*.7+pos.getZ(i)*.9);
      rgb[i*3]=paint.r*wear;rgb[i*3+1]=paint.g*wear;rgb[i*3+2]=paint.b*wear;
    }
    g.setAttribute('color',new T.BufferAttribute(rgb,3));g.deleteAttribute('uv');
    if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}
    pieces.push(g);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color:string){
    finish(new T.BoxGeometry(w,h,d).translate(x,y,z),color);
  }
  type Point=[number,number,number];
  function bar(from:Point,to:Point,width:number,color:string){
    const a=new T.Vector3(...from),b=new T.Vector3(...to),axis=b.clone().sub(a);
    const pose=a.addScaledVector(axis,.5);rotation.setFromUnitVectors(up,axis.clone().normalize());
    matrix.compose(pose,rotation,new T.Vector3(width,axis.length(),width));
    finish(new T.BoxGeometry().applyMatrix4(matrix),color);
  }
  box(144,-1.8,-30,12,3.6,68,'#777365');
  for(let z=-60;z<5;z+=4.2)box(137.9,-1.8,z,.42,3.1,.42,'#463f37');
  // Two rail-mounted portal cranes with open gantries and hanging hook blocks.
  for(const [z,height] of [[-39,19],[-8,15]]){
    const red='#965e46',dark='#454c49',x=144;
    for(const dx of [-2.8,2.8])for(const dz of [-2.6,2.6]){
      box(x+dx,.48,z+dz,1.1,.94,1.6,dark);
      bar([x+dx,.9,z+dz],[x+dx*.65,9,z+dz*.55],.40,red);
    }
    for(const side of [-1,1]){
      bar([x+side*2.6,2,z-2.55],[x+side*1.9,8.7,z+1.5],.19,red);
      bar([x+side*2.6,2,z+2.55],[x+side*1.9,8.7,z-1.5],.19,red);
    }
    box(x,9,z,5,.8,4.6,dark);box(x+.8,10.6,z,3.2,2.4,3.2,red);
    box(x-1.2,10.3,z-1.4,1.55,1.7,1.5,'#d1bd93');
    box(x-2,10.55,z-1.4,.08,.62,1.22,'#354b50');
    for(const offset of [-.45,.45]){
      bar([x,10,z+offset],[x-11,height,z+offset],.19,red);
      bar([x,11.6,z+offset],[x-11,height+.48,z+offset],.18,red);
      for(let i=0;i<6;i++){
        const t=i/6,u=(i+1)/6;
        bar([x-11*t,10+(height-10)*t,z+offset],[x-11*u,11.6+(height-11.12)*u,z+offset],.12,red);
      }
    }
    bar([x-11,height,z],[x-11,6,z],.07,dark);box(x-11,5.9,z,.5,.5,.36,dark);
  }
  for(let i=0;i<8;i++){
    const z=-55+i*6,x=147.5,y=i%3===1?2.7:0;
    const color=['#725950','#64766b','#8d7957','#657479'][i%4];
    box(x,y+1.3,z,2.7,2.6,5.7,color);
    if(y)box(x,1.3,z,2.7,2.6,5.7,'#646762');
    for(let rib=0;rib<12;rib++)box(x-1.36,y+1.3,z-2.52+rib*.455,.08,2.35,.07,color);
  }
  // A coastal cargo vessel, broadside to the quay. Ring widths form the bow and stern.
  const hull=new T.BufferGeometry(),vertices:number[]=[];
  const stations=[[-23,.35],[-18,2.7],[-12,3.8],[11,3.8],[18,2.85],[21,.85]];
  for(const side of [-1,1])for(let i=1;i<stations.length;i++){
    const [za,wa]=stations[i-1],[zb,wb]=stations[i];
    const a:Point=[131+side*wa,-.63,za-23],b:Point=[131+side*wb,-.63,zb-23];
    const c:Point=[131+side*wb*.72,-3.85,zb-23],d:Point=[131+side*wa*.72,-3.85,za-23];
    // Winding faces away from the hull on both sides.
    for(const v of (side===1?[a,b,c,a,c,d]:[c,b,a,d,c,a]))vertices.push(...v);
    const midA:Point=[131,-.63,za-23],midB:Point=[131,-.63,zb-23];
    for(const v of (side===1?[a,midA,midB,a,midB,b]:[midB,midA,a,b,midB,a]))vertices.push(...v);
  }
  hull.setAttribute('position',new T.Float32BufferAttribute(vertices,3));hull.computeVertexNormals();finish(hull,'#454f50');
  box(131,.64,-9,5.5,2.55,5.3,'#d1c7ad');box(131,2.54,-9,5.9,1.35,4.5,'#e0d5b8');
  for(let i=0;i<5;i++)box(128.02,2.66,-10.62+i*.80,.10,.57,.64,'#354c51');
  box(132,4.55,-7.8,1.17,2.75,1.4,'#a76748');box(132,5.9,-7.8,1.22,.46,1.47,'#3f4947');
  for(let i=0;i<3;i++)box(131,-.19,-35+i*6,5.1,.88,5.2,'#775f51');
  const merged=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());merged.computeBoundingSphere();
  const mesh=new T.Mesh(merged,new T.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:.15}));
  mesh.name='Island harbour · quay and freighter';mesh.matrixAutoUpdate=false;
  return mesh;
}
