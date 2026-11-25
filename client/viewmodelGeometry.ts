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
   const geometry=new T.CylinderGeometry(top,bottom,height,24,32),positions=geometry.getAttribute('position');
   for(let i=0;i<positions.count;i++){
    const y=positions.getY(i),t=(y+height/2)/height;
    const angle=Math.atan2(positions.getZ(i),positions.getX(i));
    const wrist=top<bottom?1-t:t;
    // A fitted cuff has two raised stitched edges. Above it the fabric
    // bunches diagonally as the forearm bends, especially near the wrist.
    const seam=(at:number,width:number)=>Math.exp(-Math.pow((wrist-at)/width,2));
    const cuff=1+.075*seam(.025,.016)+.10*seam(.145,.019);
    const envelope=T.MathUtils.smoothstep(wrist,.15,.24)*(1-.64*wrist);
    const folds=cuff+envelope*(.105*Math.sin(wrist*41+1.55*Math.sin(angle))
      +.053*Math.sin(wrist*68-angle*2)+.035*Math.cos(angle*3));
    positions.setXYZ(i,positions.getX(i)*folds,y+(bounds.max.y+bounds.min.y)/2,positions.getZ(i)*.9*folds);
   }
   geometry.computeVertexNormals();object.geometry=geometry;source.dispose();
  }else if(object.name.startsWith('hand-')){
   const geometry=object.geometry,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');if(!n)return;
   const side=object.name.endsWith('-l')?-1:1;
   const knuckles=[[.0245,.093],[.0045,.097],[-.0145,.093],[-.0315,.083]];
   for(let i=0;i<p.count;i++){
    const x=p.getX(i)*side,y=p.getY(i),z=p.getZ(i);
    const dorsal=T.MathUtils.smoothstep(-n.getZ(i),.35,.92);
    let relief=0;
    for(const [jointX,jointY] of knuckles){
     const radial=((x-jointX)/.009)**2+((y-jointY)/.012)**2;
     relief=Math.max(relief,Math.exp(-radial));
    }
    // Preserve the palmar surface that meets the grip.
    p.setZ(i,z-.0016*dorsal*relief);
   }
   p.needsUpdate=true;
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
