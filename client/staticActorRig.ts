import * as T from 'three';
import type {Player} from '../shared/game';
import type {BodyPart} from '../shared/injuries';

type Influence=[number,number];
/** Bind the original continuous surface to a fitted skeleton; never cut triangles into rigid chunks. */
export function createStaticActorRig(root:T.Group,owned:Set<T.BufferGeometry>){
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),sources:T.Mesh[]=[],bounds=new T.Box3(),vertex=new T.Vector3();
 root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.SkinnedMesh))sources.push(o);});
 for(const mesh of sources){const position=mesh.geometry.getAttribute('position'),transform=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);for(let i=0;i<position.count;i++)bounds.expandByPoint(vertex.fromBufferAttribute(position,i).applyMatrix4(transform));}
 const height=Math.max(.5,bounds.max.y-bounds.min.y),scale=height/1.8,centerX=(bounds.min.x+bounds.max.x)/2,baseY=bounds.min.y;
 const bones:T.Bone[]=[],absolute:T.Vector3[]=[],indices=new Map<string,number>(),parts={} as Record<BodyPart,T.Bone>;
 const bone=(name:string,pivot:[number,number,number],parent?:T.Bone)=>{const b=new T.Bone();b.name=name;const point=new T.Vector3(centerX+pivot[0]*scale,baseY+pivot[1]*scale,pivot[2]*scale);b.position.copy(point);if(parent)b.position.sub(absolute[bones.indexOf(parent)]);indices.set(name,bones.length);absolute.push(point);bones.push(b);(parent??root).add(b);return b;};
 const body=bone('static-body',[0,.95,0]),chest=bone('static-chest',[0,1.28,0],body);
 parts.body=body;parts.head=bone('static-head',[0,1.53,0],chest);
 const knees:T.Bone[]=[],feet:T.Bone[]=[];
 for(const side of ['L','R'] as const){const sign=side==='L'?-1:1,arm=bone(`static-arm${side}`,[sign*.24,1.4,0],chest),lower=bone(`static-lower${side}`,[sign*.44,1.2,0],arm);bone(`static-hand${side}`,[sign*.61,1,-.02],lower);parts[side==='L'?'armL':'armR']=arm;
  const leg=bone(`static-leg${side}`,[sign*.1,.86,0],body),knee=bone(`static-knee${side}`,[sign*.1,.5,0],leg),foot=bone(`static-foot${side}`,[sign*.1,.1,-.01],knee);parts[side==='L'?'legL':'legR']=leg;knees.push(knee);feet.push(foot);
 }
 root.updateWorldMatrix(true,true);const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
 const id=(name:string)=>indices.get(name)!;
 function weights(x:number,y:number):Influence[]{
  const influences=new Map<number,number>(),add=(name:string,weight:number)=>{if(weight>.000001){const index=id(name);influences.set(index,(influences.get(index)??0)+weight);}};
  const side=x<0?'L':'R',ax=Math.abs(x),arm=T.MathUtils.smoothstep(ax,.18,.34)*T.MathUtils.smoothstep(y,.80,1.01)*(1-T.MathUtils.smoothstep(y,1.60,1.78)),head=T.MathUtils.smoothstep(y,1.46,1.60)*(1-arm),leg=(1-T.MathUtils.smoothstep(y,.78,.98))*T.MathUtils.smoothstep(ax,.015,.065)*(1-arm),torso=Math.max(0,1-arm-head-leg),chestBlend=T.MathUtils.smoothstep(y,1.01,1.31);
  add('static-body',torso*(1-chestBlend));add('static-chest',torso*chestBlend);add('static-head',head);
  if(arm>0){const sx=.24,sy=1.4,dx=.37,dy=-.4,t=T.MathUtils.clamp(((ax-sx)*dx+(y-sy)*dy)/(dx*dx+dy*dy),0,1),elbow=T.MathUtils.smoothstep(t,.33,.63),wrist=T.MathUtils.smoothstep(t,.78,.97);add(`static-arm${side}`,arm*(1-elbow));add(`static-lower${side}`,arm*elbow*(1-wrist));add(`static-hand${side}`,arm*elbow*wrist);}
  if(leg>0){const knee=1-T.MathUtils.smoothstep(y,.40,.62),ankle=1-T.MathUtils.smoothstep(y,.09,.23);add(`static-leg${side}`,leg*(1-knee));add(`static-knee${side}`,leg*knee*(1-ankle));add(`static-foot${side}`,leg*knee*ankle);}
  const selected=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4);if(!selected.length)return [[id('static-body'),1]];const sum=selected.reduce((total,entry)=>total+entry[1],0);return selected.map(([index,weight])=>[index,weight/sum]);
 }
 const meshes:T.SkinnedMesh[]=[];
 for(const source of sources){const geometry=source.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,source.matrixWorld)),position=geometry.getAttribute('position'),skinIndex=new Uint16Array(position.count*4),skinWeight=new Float32Array(position.count*4);
  for(let i=0;i<position.count;i++){const influences=weights((position.getX(i)-centerX)/scale,(position.getY(i)-baseY)/scale);for(let n=0;n<influences.length;n++){skinIndex[i*4+n]=influences[n][0];skinWeight[i*4+n]=influences[n][1];}}
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();owned.add(geometry);
  const mesh=new T.SkinnedMesh(geometry,source.material);mesh.name=source.name;mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton,root.matrixWorld);mesh.normalizeSkinWeights();meshes.push(mesh);source.removeFromParent();
 }
 root.userData.limbRoots={head:'static-head',armL:'static-armL',armR:'static-armR',legL:'static-legL',legR:'static-legR'};skeleton.update();
 return {parts,skeleton,meshes,update(p:Player,phase:number,speed:number){const active=p.hp>0?speed:0,heavy=p.uniform==='commander',stride=Math.sin(phase)*(heavy?.25:.29)*active;
  parts.legL.rotation.x=stride;parts.legR.rotation.x=-stride;
  for(let i=0;i<2;i++){const swing=Math.sin(phase+i*Math.PI);knees[i].rotation.x=-Math.max(0,-swing)*.55*active;feet[i].rotation.x=-(i===0?stride:-stride)*.35-knees[i].rotation.x*.25;}
  if(p.uniform!=='leatherface'){parts.armL.rotation.x=-stride*.4;parts.armR.rotation.x=stride*.4;}
  parts.head.rotation.x=-p.pitch*.3;parts.body.rotation.z=Math.sin(phase)*.006*active;parts.body.position.y=(.95+Math.abs(Math.sin(phase))*.009*active)*scale+baseY;chest.rotation.x=p.sprinting?.055:0;root.updateWorldMatrix(true,true);skeleton.update();
 }};
}
