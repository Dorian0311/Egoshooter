import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {freezeStaticTransforms} from '../client/staticTransforms';
import {createActorDetails} from '../client/actorDetails';
import {createGpuTiming} from '../client/gpuTiming';
import {ResolutionGovernor} from '../client/graphicsSettings';
import {ShadowCadence} from '../client/shadowCadence';

test('cached static transforms preserve world placement and still follow a moving parent',()=>{
 const parent=new T.Group(),root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());parent.add(root);root.add(mesh);parent.position.x=10;mesh.position.set(2,3,4);
 freezeStaticTransforms(root);assert.equal(mesh.matrixAutoUpdate,false);assert.deepEqual(mesh.getWorldPosition(new T.Vector3()).toArray(),[12,3,4]);
 parent.position.x=20;parent.updateMatrixWorld(true);assert.deepEqual(mesh.getWorldPosition(new T.Vector3()).toArray(),[22,3,4]);
 mesh.geometry.dispose();(mesh.material as T.Material).dispose();
});

test('automatic shadows never redraw on consecutive slow frames and retain a 30 Hz ceiling',()=>{
 for(const rate of [20,30,40,60,120,144]){
  const cadence=new ShadowCadence();let updates=0,last=-2;
  for(let i=0;i<rate*3;i++)if(cadence.update(1/rate,'auto')){assert.ok(i-last>=2);last=i;updates++;}
  assert.ok(updates<=Math.min(rate*3/2,90)+1,`${rate} Hz: ${updates}`);
  if(rate===60)assert.ok(updates>=89);
 }
 const cadence=new ShadowCadence();cadence.update(1/60,'auto');cadence.reset();assert.equal(cadence.update(0,'auto'),true);
 for(let i=0;i<5;i++)assert.equal(cadence.update(1/60,'high'),true);
});

test('subpixel detail budget preserves skinning, injury visibility and zoomed-in detail',()=>{
 const root=new T.Group(),material=new T.MeshStandardMaterial(),small=new T.Mesh(new T.SphereGeometry(.02),material),body=new T.Mesh(new T.BoxGeometry(1,1.8,1),material),skin=new T.SkinnedMesh(new T.SphereGeometry(.02),material);root.add(small,body,skin);small.castShadow=true;small.layers.enable(2);
 const details=createActorDetails(root);assert.equal(details.update(40,720,72),1);
 assert.equal(small.layers.isEnabled(0),false);assert.equal(small.layers.isEnabled(2),true);assert.equal(body.layers.isEnabled(0),true);assert.equal(skin.layers.isEnabled(0),true);
 small.visible=false;details.update(20,720,15);assert.equal(small.layers.isEnabled(0),true);assert.equal(small.visible,false);assert.equal(small.castShadow,true);
 details.dispose();assert.equal(small.castShadow,true);for(const m of [small,body,skin])m.geometry.dispose();material.dispose();
});

test('skinned visibility bounds enclose moving bones at model scale and restore original culling',()=>{
 const root=new T.Group();root.scale.setScalar(.01);root.position.set(4,0,-3);
 const geometry=new T.BoxGeometry(50,180,30),count=geometry.getAttribute('position').count;
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));
 const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const material=new T.MeshStandardMaterial(),mesh=new T.SkinnedMesh(geometry,material),bone=new T.Bone();mesh.add(bone);root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton([bone]));mesh.frustumCulled=false;
 const budget=createActorDetails(root);assert.equal(mesh.frustumCulled,true);
 for(const turn of [-.6,0,.6]){
  bone.rotation.z=turn;bone.position.x=turn*70;root.rotation.y=turn;root.updateMatrixWorld(true);mesh.skeleton.update();
  const sphere=mesh.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld),point=new T.Vector3();
  for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);assert.ok(sphere.containsPoint(point));}
 }
 budget.dispose();assert.equal(mesh.frustumCulled,false);assert.equal(mesh.boundingSphere,null);mesh.skeleton.dispose();geometry.dispose();material.dispose();
});

test('resolution feedback preserves quality on CPU stalls and recovers only with real GPU headroom',()=>{
 const cpuBound=new ResolutionGovernor(),gpuBound=new ResolutionGovernor();
 for(let i=0;i<1000;i++){cpuBound.update(1/40,true,7,22);gpuBound.update(1/40,true,25,6);}
 assert.equal(cpuBound.scale,1);assert.equal(gpuBound.scale,.55);
 for(let i=0;i<900;i++)gpuBound.update(1/60,true,15,7);assert.equal(gpuBound.scale,.55,'60 FPS alone does not prove spare GPU capacity');
 for(let i=0;i<620;i++)gpuBound.update(1/60,true,8,6);assert.ok(gpuBound.scale>.55);
});

test('CPU-bound frames with moderate GPU usage retain detail, while sustained GPU pressure reduces it',()=>{
 const cpuBound=new ResolutionGovernor(),gpuBound=new ResolutionGovernor();
 for(let i=0;i<900;i++){
  cpuBound.update(1/42,true,14,21);
  gpuBound.update(1/51,true,19,7);
 }
 assert.equal(cpuBound.scale,1);assert.equal(gpuBound.scale,.55);
});

function fakeGpu(supported=true){
 const queries:{ready:boolean;ns:number;deleted:boolean}[]=[],canvas=new EventTarget();let reads=0,disjoint=false,lost=false;
 const gl={canvas,QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,
  getExtension:()=>supported?{TIME_ELAPSED_EXT:3,GPU_DISJOINT_EXT:4}:null,
  isContextLost:()=>lost,createQuery:()=>{const q={ready:false,ns:16e6,deleted:false};queries.push(q);return q;},
  beginQuery(){},endQuery(){},deleteQuery(q:typeof queries[number]){q.deleted=true;},getParameter:()=>disjoint,
  getQueryParameter(q:typeof queries[number],kind:number){if(kind===1)return q.ready;reads++;assert.ok(q.ready);assert.ok(!q.deleted);return q.ns;},
 };
 return {gl:gl as unknown as WebGL2RenderingContext,queries,canvas,reads:()=>reads,setDisjoint:(v:boolean)=>{disjoint=v;},lose(){lost=true;canvas.dispatchEvent(new Event('webglcontextlost'));},restore(){lost=false;}};
}

test('GPU timing never reads unavailable results, bounds its pool and reuses query objects',()=>{
 const fake=fakeGpu(),timer=createGpuTiming(fake.gl);
 for(let i=0;i<10;i++){timer.poll();timer.begin();timer.end();}
 assert.equal(fake.queries.length,3);assert.equal(fake.reads(),0);
 for(const q of fake.queries)q.ready=true;timer.poll();assert.equal(timer.state.samples,3);assert.equal(timer.state.ms,16);
 timer.begin();timer.end();assert.equal(fake.queries.length,3);timer.dispose();assert.ok(fake.queries.every(q=>q.deleted));
});

test('invalid/disjoint GPU timing is discarded without changing render quality inputs',()=>{
 const fake=fakeGpu(),timer=createGpuTiming(fake.gl);timer.poll();timer.begin();timer.end();fake.queries[0].ready=true;fake.setDisjoint(true);timer.poll();
 assert.equal(fake.reads(),0);assert.equal(timer.state.ms,undefined);assert.ok(fake.queries[0].deleted);timer.dispose();
});

test('context loss discards stale queries and restoration re-enables timing',()=>{
 const fake=fakeGpu(),timer=createGpuTiming(fake.gl);timer.poll();timer.begin();timer.end();fake.lose();assert.equal(timer.state.ms,undefined);
 fake.restore();timer.poll();timer.begin();timer.end();const restored=fake.queries.at(-1)!;restored.ready=true;timer.poll();assert.equal(timer.state.samples,1);timer.dispose();
});

test('unsupported GPU timers remain a no-op fallback',()=>{
 const fake=fakeGpu(false),timer=createGpuTiming(fake.gl);timer.poll();timer.begin();timer.end();assert.equal(timer.state.supported,false);assert.equal(fake.queries.length,0);timer.dispose();
});
