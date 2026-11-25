import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The existing rail deck and its collision bounds are shared with the server. */
export function createCologneBridgeSteel(){
  const parts:T.BufferGeometry[]=[];
  const from=new T.Vector3(),to=new T.Vector3(),offset=new T.Vector3(),up=new T.Vector3(0,1,0);
  const rotation=new T.Quaternion(),color=new T.Color();
  const painted='#46554a',rim='#6f7969',recess='#343e37',connection='#594f45';
  type Point=[number,number,number];
  function beam(a:Point,b:Point,width:number,depth:number,tint:string){
    from.set(...a);to.set(...b);offset.subVectors(to,from);
    const length=offset.length();
    rotation.setFromUnitVectors(up,offset.divideScalar(length));
    const indexed=new T.BoxGeometry(width,length,depth);
    const geometry=indexed.toNonIndexed();
    indexed.dispose();
    geometry.deleteAttribute('uv');
    geometry.applyQuaternion(rotation).translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
    color.set(tint);
    const normal=geometry.getAttribute('normal'),colors=new Float32Array(normal.count*3);
    for(let i=0;i<normal.count;i++){
      const shade=.89+normal.getY(i)*.055+.055*Math.cos(a[0]*.71+a[2]*1.2);
      colors[i*3]=color.r*shade;colors[i*3+1]=color.g*shade;colors[i*3+2]=color.b*shade;
    }
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    parts.push(geometry);
  }
  for(const start of [-30,-10,10]){
    const height=(panel:number)=>1+9*Math.sin(Math.PI*panel/12);
    const x=(panel:number)=>start+panel*20/12;
    for(const side of [-1,1]){
      const z=side*8.8;
      for(let panel=0;panel<12;panel++){
        const a=x(panel),b=x(panel+1),y0=height(panel),y1=height(panel+1);
        beam([a,y0,z],[b,y1,z],.41,.42,painted);
        beam([a,y0+.19,z],[b,y1+.19,z],.065,.53,rim);
        beam([a,y0-.19,z],[b,y1-.19,z],.065,.52,recess);
        const mid=(a+b)/2;
        if(panel&&panel<11){
          beam([a,.86,z],[a,y0-.14,z],.14,.20,painted);
          beam([a,y0-.47,z+side*.21],[a,y0+.41,z+side*.21],.48,.06,rim);
        }
        if(panel>=2&&panel<10){
          const diagonal=(panel<6?y1:y0)-.23;
          beam([panel<6?a:b,1.02,z],[panel<6?b:a,diagonal,z],.095,.16,recess);
          beam([mid,.77,z+side*.215],[mid,1.04,z+side*.215],.28,.065,connection);
        }
      }
      beam([start,.94,z],[start+20,.94,z],.18,.25,painted);
    }
    for(const panel of [3,6,9]){
      const y=height(panel)-.29;
      beam([x(panel),y,-8.71],[x(panel),y,8.71],.21,.24,painted);
      const next=panel+1;
      if(panel!==9){
        beam([x(panel),y,-8.71],[x(next),height(next)-.29,8.71],.10,.15,recess);
        beam([x(panel),y,8.71],[x(next),height(next)-.29,-8.71],.10,.15,recess);
      }
    }
  }
  const geometry=mergeGeometries(parts)!;
  parts.forEach(part=>part.dispose());
  geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,metalness:.44,roughness:.66}));
  mesh.name='Cologne bridge trusses';
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;
  return mesh;
}
