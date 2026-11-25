import * as T from 'three';
import type {Fixture} from '../shared/interiors';

export function createWindowPanes(root:T.Group,fixtures:Fixture[],glass:T.Material){
 const facades=new Map<string,Fixture[]>();
 for(const pane of fixtures){
  if(pane.type!=='glass')continue;
  const key=pane.building+':'+pane.box.x;
  const face=facades.get(key);
  if(face)face.push(pane);else facades.set(key,[pane]);
 }
 const geometry=new T.PlaneGeometry(1,1);
 const transform=new T.Object3D();transform.rotation.y=Math.PI/2;
 // All panes in a facade lie in one plane and never overlap. The opposite
 // facade remains a separate transparent object with its own sort centre.
 const batches=Array.from(facades.values(),face=>{
  const mesh=new T.InstancedMesh(geometry,glass,face.length);
  mesh.name='glass-facade-'+face[0].building;
  for(const {box:b} of face){mesh.position.x+=b.x;mesh.position.y+=b.y;mesh.position.z+=b.z;}
  mesh.position.divideScalar(face.length);
  mesh.receiveShadow=true;mesh.updateMatrix();mesh.matrixAutoUpdate=false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const panes=face.map(({id,box:b},index)=>{
   transform.position.set(b.x-mesh.position.x,b.y-mesh.position.y,b.z-mesh.position.z);
   transform.scale.set(b.d,b.h,1);transform.updateMatrix();
   const matrix=transform.matrix.clone();mesh.setMatrixAt(index,matrix);return {id,matrix};
  });
  mesh.computeBoundingSphere();root.add(mesh);
  return {mesh,panes,mask:(1<<panes.length)-1};
 });
 let previous:string[]=[];
 return {
  sync(broken:string[]){
   if(previous.length===broken.length&&previous.every((id,i)=>id===broken[i]))return;
   previous=[...broken];
   for(const batch of batches){
    const {mesh,panes}=batch;
    let mask=0;
    for(let i=0;i<panes.length;i++)if(!broken.includes(panes[i].id))mask|=1<<i;
    if(mask===batch.mask)continue;
    batch.mask=mask;mesh.count=0;
    for(let i=0;i<panes.length;i++)if(mask&(1<<i))mesh.setMatrixAt(mesh.count++,panes[i].matrix);
    mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;
   }
  },
  dispose(){for(const {mesh} of batches){mesh.removeFromParent();mesh.dispose();}geometry.dispose();}
 };
}
