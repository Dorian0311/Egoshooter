import * as T from 'three';
import type {Player} from '../shared/game';
import type {BodyPart} from '../shared/injuries';
const pivots:Record<BodyPart,[number,number,number]>={body:[0,0,0],head:[0,1.53,0],armL:[-.24,1.4,0],armR:[.24,1.4,0],legL:[-.1,.86,0],legR:[.1,.86,0]};
/** Static supplied figures get articulated, spatially calibrated parts without modifying source assets. */
export function createStaticActorRig(root:T.Group,owned:Set<T.BufferGeometry>){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),parts={} as Record<BodyPart,T.Group>,meshes:T.Mesh[]=[],v=new T.Vector3();
 for(const part of Object.keys(pivots) as BodyPart[]){const pivot=new T.Group();pivot.name=`static-${part}`;pivot.position.set(...pivots[part]);root.add(pivot);parts[part]=pivot;}
 root.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
 for(const mesh of meshes){const geometry=mesh.geometry,position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');if(!position)continue;
  const transform=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),normalMatrix=new T.Matrix3().getNormalMatrix(transform),indices=geometry.index?.array??Array.from({length:position.count},(_,n)=>n),buckets=new Map<BodyPart,{p:number[];n:number[];uv:number[];materials:number[]}>();
  for(let start=0;start<indices.length;start+=3){const points=[0,1,2].map(n=>new T.Vector3().fromBufferAttribute(position,indices[start+n]).applyMatrix4(transform)),center=points.reduce((sum,p)=>sum.add(p),new T.Vector3()).divideScalar(3);
   const part:BodyPart=center.y>1.53?'head':Math.abs(center.x)>.23&&center.y>.68?center.x<0?'armL':'armR':center.y<.86&&Math.abs(center.x)>.025?center.x<0?'legL':'legR':'body';
   let bucket=buckets.get(part);if(!bucket){bucket={p:[],n:[],uv:[],materials:[]};buckets.set(part,bucket);}const material=geometry.groups.find(g=>start>=g.start&&start<g.start+g.count)?.materialIndex??0;bucket.materials.push(material);
   for(let n=0;n<3;n++){const index=indices[start+n],p=points[n].sub(parts[part].position);bucket.p.push(p.x,p.y,p.z);if(normal){v.fromBufferAttribute(normal,index).applyNormalMatrix(normalMatrix);bucket.n.push(v.x,v.y,v.z);}bucket.uv.push(uv?.getX(index)??0,uv?.getY(index)??0);}
  }
  for(const [part,bucket]of buckets){const next=new T.BufferGeometry();next.setAttribute('position',new T.Float32BufferAttribute(bucket.p,3));next.setAttribute('uv',new T.Float32BufferAttribute(bucket.uv,2));if(bucket.n.length)next.setAttribute('normal',new T.Float32BufferAttribute(bucket.n,3));else next.computeVertexNormals();let groupStart=0,last=bucket.materials[0];for(let n=1;n<=bucket.materials.length;n++)if(bucket.materials[n]!==last){next.addGroup(groupStart*3,(n-groupStart)*3,last);groupStart=n;last=bucket.materials[n];}owned.add(next);const object=new T.Mesh(next,mesh.material);object.userData.bodyPart=part;object.castShadow=true;object.receiveShadow=true;parts[part].add(object);}
  mesh.removeFromParent();
 }
 root.userData.limbRoots={head:'static-head',armL:'static-armL',armR:'static-armR',legL:'static-legL',legR:'static-legR'};
 return {parts,update(p:Player,phase:number,speed:number){const heavy=p.uniform==='commander',stride=Math.sin(phase)*(heavy?.20:.30)*speed;parts.legL.rotation.x=stride;parts.legR.rotation.x=-stride;parts.armL.rotation.x=-stride*.6;parts.armR.rotation.x=stride*.6;parts.head.rotation.x=-p.pitch*.3;parts.body.rotation.z=Math.sin(phase)*.008*speed;}};
}
