import * as T from 'three';
import {terrainHeight} from '../shared/terrain';
import type {Building,World} from '../shared/world';

/** Soft local grounding for walls/feet; two instanced draws, no screen-space pass. */
export function createContactShadows(scene:T.Scene,buildings:Building[],world?:World){
 const geometry=new T.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
 const actorGeometry=geometry.clone();
 for(const [i,plane] of [geometry,actorGeometry].entries()){
  const uv=plane.getAttribute('uv');
  for(let n=0;n<uv.count;n++)uv.setX(n,(i*32+.5+uv.getX(n)*31)/64);
 }
 const pixels=new Uint8Array(64*32*4);
 const falloff=(x:number,y:number)=>Math.max(0,1-x*x-y*y)**2.8;
 for(let y=0;y<32;y++)for(let x=0;x<64;x++){
  const u=(x%32-15.5)/15.5,v=(y-15.5)/15.5;
  const radial=falloff(u,v);
  // Two denser lobes sit beneath the stance, inside a wider soft shadow.
  const feet=Math.max(falloff((u-.29)*1.62,v*1.48),falloff((u+.29)*1.62,v*1.48));
  const alpha=x<32?radial:Math.min(1,radial*.63+feet*.57);
  const i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(alpha*255);
 }
 const texture=new T.DataTexture(pixels,64,32);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
 const material=new T.MeshBasicMaterial({color:'#29261e',map:texture,transparent:true,opacity:.27,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const walls=new T.InstancedMesh(geometry,material,Math.max(1,buildings.length*4));walls.name='wall-contact-shadows';walls.count=0;
 const actors=new T.InstancedMesh(actorGeometry,material,128);actors.name='actor-contact-shadows';actors.count=0;actors.frustumCulled=false;actors.instanceMatrix.setUsage(T.DynamicDrawUsage);
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3();
 const yawRotation=new T.Quaternion(),up=new T.Vector3(0,1,0),normal=new T.Vector3();
 const slopes=new Map<number,{y:number;normal:T.Vector3}>();
 function groundSlope(x:number,z:number){
  if(!world||(world.id!=='storm'&&world.id!=='frontline'))return;
  const sx=Math.round(x*2),sz=Math.round(z*2),key=(sx+512)*1024+sz+512;
  const saved=slopes.get(key);if(saved)return saved;
  const px=sx/2,pz=sz/2,y=terrainHeight(px,pz,world);
  const slope={y,normal:new T.Vector3(y-terrainHeight(px+.5,pz,world),.5,y-terrainHeight(px,pz+.5,world)).normalize()};
  if(slopes.size>=1536)slopes.clear();
  slopes.set(key,slope);return slope;
 }
 const place=(mesh:T.InstancedMesh,index:number,x:number,y:number,z:number,w:number,d:number)=>{
  position.set(x,y+.018,z);scale.set(w,1,d);matrix.compose(position,rotation,scale);mesh.setMatrixAt(index,matrix);
 };
 // Split at doorways; never lay a dark strip across an entrance.
 for(const b of buildings)for(const side of [-1,1])for(const direction of [-1,1]){
  place(walls,walls.count++,b.x+direction*(b.w/4+1),0,b.z+side*(b.d/2+.22),b.w/2-2,2.1);
 }
 if(walls.count)walls.computeBoundingSphere();scene.add(walls,actors);
 return {
  begin(){actors.count=0;},
  actor(x:number,y:number,z:number,crouching=false,yaw=0){
   if(actors.count>=128)return;
   const slope=groundSlope(x,z);
   normal.copy(slope&&Math.abs(y-slope.y)<.19?slope.normal:up);
   rotation.setFromUnitVectors(up,normal).multiply(yawRotation.setFromAxisAngle(up,yaw));
   place(actors,actors.count++,x,y,z,crouching?1.16:1.02,crouching?.94:.76);
  },
  end(){actors.instanceMatrix.needsUpdate=true;},
  dispose(){scene.remove(walls,actors);walls.dispose();actors.dispose();geometry.dispose();actorGeometry.dispose();material.dispose();texture.dispose();slopes.clear();},
 };
}
