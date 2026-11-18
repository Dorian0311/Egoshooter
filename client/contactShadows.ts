import * as T from 'three';
import type {Building} from '../shared/world';

/** Soft local grounding for walls/feet; two instanced draws, no screen-space pass. */
export function createContactShadows(scene:T.Scene,buildings:Building[]){
 const geometry=new T.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
 const pixels=new Uint8Array(32*32*4);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const radius=((x-15.5)/15.5)**2+((y-15.5)/15.5)**2;
  const i=(y*32+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.max(0,1-radius)**2*255);
 }
 const texture=new T.DataTexture(pixels,32,32);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
 const material=new T.MeshBasicMaterial({color:'#29261e',map:texture,transparent:true,opacity:.20,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const walls=new T.InstancedMesh(geometry,material,Math.max(1,buildings.length*4));walls.name='wall-contact-shadows';walls.count=0;
 const actors=new T.InstancedMesh(geometry,material,128);actors.name='actor-contact-shadows';actors.count=0;actors.frustumCulled=false;actors.instanceMatrix.setUsage(T.DynamicDrawUsage);
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3();
 const place=(mesh:T.InstancedMesh,index:number,x:number,y:number,z:number,w:number,d:number)=>{
  position.set(x,y+.018,z);scale.set(w,1,d);matrix.compose(position,rotation,scale);mesh.setMatrixAt(index,matrix);
 };
 // Split at doorways; never lay a dark strip across an entrance.
 for(const b of buildings)for(const side of [-1,1])for(const direction of [-1,1]){
  place(walls,walls.count++,b.x+direction*(b.w/4+1),0,b.z+side*(b.d/2+.22),b.w/2-2,1.6);
 }
 if(walls.count)walls.computeBoundingSphere();scene.add(walls,actors);
 return {
  begin(){actors.count=0;},
  actor(x:number,y:number,z:number,crouching=false){if(actors.count<128)place(actors,actors.count++,x,y,z,crouching?1.1:.85,crouching?.9:.65);},
  end(){actors.instanceMatrix.needsUpdate=true;},
  dispose(){scene.remove(walls,actors);walls.dispose();actors.dispose();geometry.dispose();material.dispose();texture.dispose();},
 };
}
