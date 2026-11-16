import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

const target=JSON.parse(await readFile('public/shooter/characters/humanoid.json','utf8'));
const reference=await readFile('research/motion-source/KinemIQ_Mannequin.glb'),length=reference.readUInt32LE(12),doc=JSON.parse(reference.subarray(20,20+length)),binary=reference.subarray(28+length),skin=doc.skins[0],accessor=doc.accessors[skin.inverseBindMatrices],view=doc.bufferViews[accessor.bufferView];
const inverseBind=new Float32Array(binary.buffer,binary.byteOffset+(view.byteOffset??0)+(accessor.byteOffset??0),accessor.count*16),rest=new Map(skin.joints.map((node,index)=>[doc.nodes[node].name,new T.Matrix4().fromArray(inverseBind,index*16).invert()]));
const mapping={root:'pelvis',spine05:'spine_01',spine03:'spine_02',spine01:'spine_03',neck01:'neck_01',head:'Head'};
for(const side of ['L','R'])for(const [to,from]of [['upperleg01','thigh'],['lowerleg01','calf'],['foot','foot'],['clavicle','clavicle'],['upperarm01','upperarm'],['lowerarm01','lowerarm'],['wrist','hand']])mapping[to+'.'+side]=from+'_'+side.toLowerCase();
const bones=target.bones.map(joint=>{const bone=new T.Bone();bone.name=joint.name;return bone;}),root=new T.Group();
target.bones.forEach((joint,index)=>{const origin=joint.parent>=0?target.bones[joint.parent].head:[0,0,0];bones[index].position.set(joint.head[0]-origin[0],joint.head[1]-origin[1],joint.head[2]-origin[2]);if(joint.parent>=0)bones[joint.parent].add(bones[index]);else root.add(bones[index]);});
const named=new Map(bones.map(bone=>[bone.name,bone])),depth=bone=>{let n=0;for(let p=bone.parent;p;p=p.parent)n++;return n;},mapped=Object.entries(mapping).filter(([name,source])=>named.has(name)&&rest.has(source)).sort((a,b)=>depth(named.get(a[0]))-depth(named.get(b[0])));
const alignment=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI),inverseAlignment=alignment.clone().invert(),q=new T.Quaternion(),inverse=new T.Quaternion(),parent=new T.Quaternion(),point=new T.Vector3(),round=value=>Math.round(value*1e5)/1e5;
const clips={},sources=[];
for(const [action,file]of Object.entries({swing:'Sword_slash',carry:'Walk_carrying',interact:'Action_interact',pickup:'Action_pick_up_from_a_table'})){
 const bytes=await readFile('research/motion-source/GLB/'+file+'.glb'),loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),mixer=new T.AnimationMixer(loaded.scene),clip=loaded.animations[0];mixer.clipAction(clip).play();const count=Math.ceil(clip.duration*30),left=[],right=[];
 for(let frame=0;frame<=count;frame++){mixer.setTime(Math.min(clip.duration-1e-6,frame/count*clip.duration));loaded.scene.updateMatrixWorld(true);for(const bone of bones)bone.quaternion.identity();root.updateMatrixWorld(true);
  for(const [name,source]of mapped){loaded.scene.getObjectByName(source).getWorldQuaternion(q);inverse.setFromRotationMatrix(rest.get(source)).invert();q.multiply(inverse).premultiply(alignment).multiply(inverseAlignment);const bone=named.get(name);bone.parent.getWorldQuaternion(parent).invert();bone.quaternion.copy(parent.multiply(q));bone.updateWorldMatrix(false,true);}
  named.get('wrist.L').getWorldPosition(point);left.push(...point.toArray().map(round));named.get('wrist.R').getWorldPosition(point);right.push(...point.toArray().map(round));
 }clips[action]={duration:round(clip.duration),frames:count+1,left,right};sources.push({clip:file,sha256:createHash('sha256').update(bytes).digest('hex')});mixer.stopAllAction();mixer.uncacheRoot(loaded.scene);console.log(action,count+1,'frames');
}
const data=JSON.stringify({license:'CC0-1.0',clips});await writeFile('public/shooter/animations/combat-hands.json',data);
await writeFile('public/shooter/animations/combat-hands-provenance.json',JSON.stringify({author:'Quaternius; CC0 export by KinemIQ',source:'https://quaternius.com/packs/universalanimationlibrary.html',mirror:'https://huggingface.co/datasets/Kinemiq/free-game-animations',license:'CC0-1.0',sources,output:{file:'combat-hands.json',bytes:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex'),modifications:'Retargeted to MakeHuman; upright1.78m, forward-Z negative, no horizontal root motion. Hand trajectories sampled30Hz for universal IK; no source meshes included.'}},null,2)+'\n');
