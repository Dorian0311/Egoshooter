import * as T from 'three';
import {islandShops} from '../shared/islandStreet';

/** Bake both hanging lamps into the existing static street batches, preserving their draw count. */
export function bakeShopLights(street:T.Object3D){
  // Each row interpolates from darkness to a shop's lamp colour in linear RGB.
  const ramp=new T.DataTexture(new Uint8Array([
    0,0,0,255, 255,169,91,255,
    0,0,0,255, 255,219,167,255,
    0,0,0,255, 255,185,128,255,
  ]),2,3);
  ramp.channel=1;ramp.minFilter=ramp.magFilter=T.LinearFilter;ramp.needsUpdate=true;
  const materials=new Map<T.MeshStandardMaterial,T.MeshStandardMaterial>();
  const bindings:{mesh:T.Mesh;original:T.MeshStandardMaterial}[]=[];
  const point=new T.Vector3(),normal=new T.Vector3(),normalMatrix=new T.Matrix3();
  street.updateWorldMatrix(true,true);
  street.traverse(object=>{
    if(!(object instanceof T.Mesh)||!(object.material instanceof T.MeshStandardMaterial))return;
    const geometry=object.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
    if(!normals||geometry.hasAttribute('uv1')||object.material.lightMap)return;
    const uv=new Float32Array(positions.count*2);
    let lit=false;
    normalMatrix.getNormalMatrix(object.matrixWorld);
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
      let energy=0,row=0;
      for(let index=0;index<islandShops.length;index++){
        const shop=islandShops[index];
        const x=point.x-shop.x,z=point.z-shop.z;
        if(Math.abs(x)>shop.w/2+.015||Math.abs(z)>shop.d/2+.015||point.y<.03||point.y>shop.h-.13)continue;
        row=index;
        normal.fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix);
        const dy=shop.h-.93-point.y;
        for(let lamp=-3;lamp<=3;lamp+=6){
          const dx=lamp-x,dz=-z,distanceSquared=dx*dx+dy*dy+dz*dz;
          const inverseDistance=1/Math.sqrt(Math.max(.05,distanceSquared));
          const cone=T.MathUtils.smoothstep(dy*inverseDistance,.17,.9);
          const facing=Math.max(0,(dx*normal.x+dy*normal.y+dz*normal.z)*inverseDistance);
          energy+=11*cone*facing/(1+distanceSquared);
        }
        break;
      }
      uv[i*2]=.25+.5*Math.min(1,energy);uv[i*2+1]=(row+.5)/3;
      lit||=energy>.001;
    }
    if(!lit)return;
    geometry.setAttribute('uv1',new T.BufferAttribute(uv,2));
    const original=object.material;
    let material=materials.get(original);
    if(!material){
      material=original.clone();material.lightMap=ramp;material.lightMapIntensity=3.3;materials.set(original,material);
    }
    bindings.push({mesh:object,original});object.material=material;
  });
  return ()=>{
    for(const {mesh,original} of bindings){mesh.material=original;mesh.geometry.deleteAttribute('uv1');}
    for(const material of materials.values())material.dispose();
    ramp.dispose();
  };
}
