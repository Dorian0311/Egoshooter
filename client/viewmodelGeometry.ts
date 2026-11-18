import * as T from 'three';

/** One-time silhouette/normal refinement. Finger positions and grip stay intact. */
export function refineViewmodelGeometry(root:T.Object3D){
 root.traverse(object=>{
  if(!(object instanceof T.Mesh)||object.userData.refinedViewmodel)return;
  if(object.name.startsWith('view-sleeve-')){
   const source=object.geometry;source.computeBoundingBox();const bounds=source.boundingBox!;
   const height=bounds.max.y-bounds.min.y;if(height<.4||height>.8)return;
   const p=source.getAttribute('position');let top=0,bottom=0;
   for(let i=0;i<p.count;i++){
    const radius=Math.hypot(p.getX(i),p.getZ(i)/.9);
    if(p.getY(i)>bounds.max.y-.025)top=Math.max(top,radius);
    if(p.getY(i)<bounds.min.y+.025)bottom=Math.max(bottom,radius);
   }
   if(!top||!bottom)return;
   const geometry=new T.CylinderGeometry(top,bottom,height,32,12),positions=geometry.getAttribute('position');
   for(let i=0;i<positions.count;i++){
    const y=positions.getY(i),t=(y+height/2)/height;
    const folds=1+Math.sin(t*Math.PI)*(.025*Math.sin(t*31)+.012*Math.sin(t*57));
    positions.setXYZ(i,positions.getX(i)*folds,y+(bounds.max.y+bounds.min.y)/2,positions.getZ(i)*.9*folds);
   }
   geometry.computeVertexNormals();object.geometry=geometry;source.dispose();
  }else if(object.name.startsWith('hand-')){
   const geometry=object.geometry,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');if(!n)return;
   const groups=new Map<string,number[]>(),normals=n.clone();
   for(let i=0;i<p.count;i++){
    const key=`${Math.round(p.getX(i)*100000)},${Math.round(p.getY(i)*100000)},${Math.round(p.getZ(i)*100000)}`;
    const indices=groups.get(key)??[];indices.push(i);groups.set(key,indices);
   }
   const sum=new T.Vector3(),original=new T.Vector3(),other=new T.Vector3();
   for(const indices of groups.values())for(const i of indices){
    original.fromBufferAttribute(normals,i);sum.set(0,0,0);
    for(const j of indices){other.fromBufferAttribute(normals,j);if(original.dot(other)>.5)sum.add(other);}
    sum.normalize();n.setXYZ(i,sum.x,sum.y,sum.z);
   }
   n.needsUpdate=true;
  }else return;
  object.userData.refinedViewmodel=true;
 });
}
