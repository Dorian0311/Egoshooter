import {createGermanWeapon,germanWeaponNames} from './germanWeaponModels';
import * as T from 'three';
import {armCount,hasLost,isCrawling} from '../shared/injuries';
import {weapons,type Player} from '../shared/game';
import {createThrowingStarGeometry} from './operationScene';
import {batchWeaponProxy} from './weaponProxy';
import {loadCombatHands,sampleCombatHands} from './combatHands';
import {harvestAnimation} from './remainsAnimation';
import {acquireWorldWeapon,prewarmWorldWeapons,type WorldWeapon} from './worldWeapons';

export type ArmChain={upper:T.Object3D;lower:T.Object3D;hand:T.Object3D};
type SavedArm=ArmChain&{rest:T.Quaternion[];reach:number;shoulder:T.Vector3;finger?:T.Object3D};
const point=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),axis=new T.Vector3(),bend=new T.Vector3(),desired=new T.Vector3(),rotation=new T.Quaternion(),parentRotation=new T.Quaternion();
function aimBone(bone:T.Object3D,from:T.Vector3,to:T.Vector3){
 if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;
 rotation.setFromUnitVectors(from.normalize(),to.normalize());bone.getWorldQuaternion(parentRotation);rotation.multiply(parentRotation);
 bone.parent?.getWorldQuaternion(parentRotation);bone.quaternion.copy(parentRotation.invert().multiply(rotation));bone.updateWorldMatrix(false,true);
}
/** Two-bone IK in world space also supports rigs with intermediate twist joints. */
export function solveArm(chain:ArmChain,target:T.Vector3,pole:T.Vector3){
 chain.upper.getWorldPosition(a);chain.lower.getWorldPosition(b);chain.hand.getWorldPosition(c);
 const upper=a.distanceTo(b),lower=b.distanceTo(c);if(upper<.01||lower<.01)return;
 axis.copy(target).sub(a);const distance=T.MathUtils.clamp(axis.length(),Math.abs(upper-lower)+.001,upper+lower-.001);axis.normalize();
 bend.copy(pole).sub(a).addScaledVector(axis,-point.copy(pole).sub(a).dot(axis));if(bend.lengthSq()<.00001)bend.set(1,0,0).addScaledVector(axis,-axis.x);bend.normalize();
 const cosine=T.MathUtils.clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1);
 desired.copy(a).addScaledVector(axis,upper*cosine).addScaledVector(bend,upper*Math.sqrt(1-cosine*cosine));
 aimBone(chain.upper,b.clone().sub(a),desired.clone().sub(a));chain.lower.getWorldPosition(b);chain.hand.getWorldPosition(c);
 desired.copy(a).addScaledVector(axis,distance);aimBone(chain.lower,c.clone().sub(b),desired.clone().sub(b));
}
export function findRigObject(root:T.Group,name:string){let match:T.Object3D|undefined;root.traverse(o=>{if(o.name===name&&(!match||o.children.length>match.children.length))match=o;});return match;}
export function rigArm(root:T.Group,names:string[]):ArmChain|undefined{const [upper,lower,hand]=names.map(name=>findRigObject(root,name));return upper&&lower&&hand?{upper,lower,hand}:undefined;}

export function createActorEquipment(root:T.Group,chains:Partial<Record<'armL'|'armR',ArmChain>>,civilian=false,embeddedSaw=false){
 void loadCombatHands();
 if(!civilian)prewarmWorldWeapons();
 root.userData.armChains=chains;
 root.updateWorldMatrix(true,true);
 const arms=Object.fromEntries(Object.entries(chains).filter(([,chain])=>!!chain).map(([key,chain])=>{const upper=root.worldToLocal(chain!.upper.getWorldPosition(new T.Vector3())),lower=root.worldToLocal(chain!.lower.getWorldPosition(new T.Vector3())),hand=root.worldToLocal(chain!.hand.getWorldPosition(new T.Vector3()));return [key,{...chain,rest:[chain!.upper.quaternion.clone(),chain!.lower.quaternion.clone(),chain!.hand.quaternion.clone()],reach:(upper.distanceTo(lower)+lower.distanceTo(hand))*.985,shoulder:upper}];})) as Partial<Record<'armL'|'armR',SavedArm>>;
 const fingers:T.Object3D[]=[],bonusFingers:{bone:T.Object3D;rest:T.Quaternion;angle:number}[]=[];root.traverse(o=>{if(/^finger\d-\d\.[LR]$/.test(o.name))fingers.push(o);const finger=o.name.match(/^UN_([LR])_F_(Index|Mid|Ring|Pinkie|Thumb)_([123])$/);if(finger)bonusFingers.push({bone:o,rest:o.quaternion.clone(),angle:(finger[1]==='L'?-1:1)*(finger[2]==='Thumb'?.4:finger[2]==='Index'&&finger[3]==='1'?.25:finger[3]==='1'?.65:finger[3]==='2'?1.1:.7)});});
 for(const arm of Object.values(arms))if(arm){arm.hand.traverse(o=>{if(/Mid_1$|middle|finger3-1|Finger2(?![\w])/i.test(o.name)&&(!arm.finger||o.children.length>arm.finger.children.length))arm.finger=o;});}
 const mount=new T.Group();mount.name='held-weapon';mount.userData.nonAnatomic=true;root.add(mount);
 const metal=new T.MeshStandardMaterial({color:'#333c3b',metalness:.7,roughness:.38}),wood=new T.MeshStandardMaterial({color:'#5d4731',roughness:.72}),polymer=new T.MeshStandardMaterial({color:'#242a27',roughness:.75}),starMaterial=new T.MeshStandardMaterial({color:'#b8c0c1',metalness:.9,roughness:.25});
 const geometries:T.BufferGeometry[]=[],models:T.Group[]=[];
 const box=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material)=>{const geometry=new T.BoxGeometry(w,h,d);geometries.push(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);};
 for(let index=0;index<weapons.length;index++){const model=new T.Group();models.push(model);mount.add(model);
  model.visible=false;
  if(index>=4&&index<=6)continue;
  if(germanWeaponNames[index]){const gun=createGermanWeapon(index);gun.rotation.y=Math.PI;model.add(gun);continue;}
  if(index===1){box(model,0,.018,-.075,.035,.045,.19,metal);box(model,0,-.04,.015,.035,.105,.045,polymer);}
  else{const length=index===0?.95:index===2?.62:.75;box(model,0,.025,-.21,.045,.065,length,metal);box(model,0,-.01,.10,.055,.075,.24,index===0?wood:polymer);box(model,0,-.065,-.025,.035,.13,.045,polymer);if(index>1)box(model,0,-.10,-.16,.04,.20,.07,metal);if(index===3)box(model,0,.09,-.14,.025,.08,.26,polymer);}
 }
 const authoredMaterials=new Set<T.Material>();for(const model of models.slice(7))model.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])authoredMaterials.add(m);});
 for(const model of models)batchWeaponProxy(model);geometries.length=0;mount.traverse(o=>{if(o instanceof T.Mesh){geometries.push(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])authoredMaterials.add(material);}});
 const starGeometry=createThrowingStarGeometry(),star=new T.Mesh(starGeometry,starMaterial);star.name='held-throwing-star';star.userData.nonAnatomic=true;root.add(star);star.visible=false;
 let previousWeapon=-1,changedAt=-Infinity;
 let disposed=false;const worldModels=new Map<number,Awaited<ReturnType<typeof acquireWorldWeapon>> & {name:WorldWeapon}>(),pendingModels=new Map<number,WorldWeapon>(),failedModels=new Set<WorldWeapon>();
 function textured(index:number,team:Player['team']){if(typeof window==='undefined'||index>3)return;const name:WorldWeapon=index===3?'g36':index===1?'luger':index===0?'kar98k':'mp40';if(worldModels.get(index)?.name===name||pendingModels.get(index)===name||failedModels.has(name))return;pendingModels.set(index,name);void acquireWorldWeapon(name).then(asset=>{if(disposed||pendingModels.get(index)!==name){asset.release();return;}const old=worldModels.get(index);if(old){old.object.removeFromParent();old.release();}for(const child of models[index].children)child.visible=false;models[index].add(asset.object);worldModels.set(index,{...asset,name});pendingModels.delete(index);}).catch(()=>{pendingModels.delete(index);failedModels.add(name);});}
 const reset=(arm:SavedArm)=>{arm.upper.quaternion.copy(arm.rest[0]);arm.lower.quaternion.copy(arm.rest[1]);arm.hand.quaternion.copy(arm.rest[2]);};
 const target=new T.Vector3(),pole=new T.Vector3(),forward=new T.Vector3(),handDirection=new T.Vector3(),right=new T.Vector3(),left=new T.Vector3(),offset=new T.Vector3(),localGrip=new T.Vector3();
 function grip(arm:SavedArm,localTarget:T.Vector3,side:number,up=false){
  reset(arm);arm.upper.updateWorldMatrix(true,true);target.copy(localTarget);root.localToWorld(target);pole.set(side*.55,1.01,.12);root.localToWorld(pole);solveArm(arm,target,pole);
  const finger=arm.hand.children.find(o=>o.name.startsWith('finger3-1'))??arm.finger??arm.hand.children.find(o=>o instanceof T.Bone);
  if(finger){arm.hand.getWorldPosition(target);finger.getWorldPosition(handDirection).sub(target);forward.set(0,up?1:arm.finger&&side<0?.6:-.6,up?0:-.8).applyQuaternion(root.getWorldQuaternion(rotation));aimBone(arm.hand,handDirection,forward);}
 }
 function gestureHand(arm:SavedArm,side:'armL'|'armR'){
  const suffix=side==='armL'?'.L':'.R',middle=findRigObject(root,'finger3-1'+suffix),middleNext=findRigObject(root,'finger3-2'+suffix),index=findRigObject(root,'finger2-1'+suffix),pinky=findRigObject(root,'finger5-1'+suffix);
  for(const finger of fingers)if(finger.name.endsWith(suffix)){const digit=Number(finger.name[6]),joint=Number(finger.name[8]);finger.rotation.set(digit===3?0:digit===1?joint===1?.7:1.0:joint===1?1.15:joint===2?1.35:.85,0,digit===1?(side==='armL'?.45:-.45):0);}
  if(!middle||!middleNext)return;arm.hand.updateWorldMatrix(true,true);const up=new T.Vector3(0,1,0).applyQuaternion(root.getWorldQuaternion(new T.Quaternion())),finger=middleNext.getWorldPosition(new T.Vector3()).sub(middle.getWorldPosition(new T.Vector3()));aimBone(arm.hand,finger,up);
  if(index&&pinky){const across=index.getWorldPosition(new T.Vector3()).sub(pinky.getWorldPosition(new T.Vector3())),normal=across.cross(up).normalize(),wanted=new T.Vector3(0,0,-1).applyQuaternion(root.getWorldQuaternion(new T.Quaternion())),angle=Math.atan2(up.dot(normal.clone().cross(wanted)),normal.dot(wanted)),delta=new T.Quaternion().setFromAxisAngle(up,angle),world=arm.hand.getWorldQuaternion(new T.Quaternion()),parent=arm.hand.parent!.getWorldQuaternion(new T.Quaternion()).invert();arm.hand.quaternion.copy(parent.multiply(delta).multiply(world));arm.hand.updateWorldMatrix(false,true);}
 }
 return {mount,update(p:Player,time:number,now:number){
  const gesture=civilian&&p.hp>0&&p.gestureUntil>now&&!isCrawling(p),throwing=p.hp>0&&p.throwAt>now&&p.throwAt-now<=750;
  if(civilian){mount.visible=false;star.visible=false;
   if(gesture){const side=hasLost(p,'armL')?'armR':'armL',arm=arms[side],other=side==='armL'?'armR':'armL';if(arm){grip(arm,new T.Vector3(side==='armL'?-.34:.34,1.37,-.28),side==='armL'?-1:1,true);gestureHand(arm,side);}if(arms[other]&&!hasLost(p,other))grip(arms[other]!,new T.Vector3(other==='armL'?-.23:.23,.86,.02),other==='armL'?-1:1);
   }else{for(const side of ['armL','armR'] as const){const arm=arms[side];if(!arm||hasLost(p,side))continue;const sign=side==='armL'?-1:1,sway=p.hp>0?Math.sin(time*.0065+(side==='armL'?0:Math.PI))*.045:0;grip(arm,new T.Vector3(sign*.24,.85+sway*.12,.015+sway),sign);}
    for(const finger of fingers){const digit=Number(finger.name[6]),joint=Number(finger.name[8]),sign=finger.name.endsWith('.L')?1:-1;finger.rotation.set(digit===1?.18:joint===1?.14:joint===2?.28:.18,0,digit===1?sign*.12:0);}
   }return;
  }
  const available=armCount(p),harvesting=p.treatment?.kind==='harvest';mount.visible=p.hp>0&&available>0&&!throwing&&p.weapon!==4&&!p.heldPart&&!harvesting;star.visible=throwing&&p.throwAt-now>610&&available>0&&(root.userData.partThrowUntil??0)<now;
  if(harvesting&&p.hp){mount.visible=star.visible=false;const progress=1-(p.treatment!.until-now)/3000,pose=harvestAnimation(progress),clip=sampleCombatHands('interact',progress);for(const side of ['armL','armR'] as const){if(hasLost(p,side))continue;const arm=arms[side];if(!arm)continue;const hand=(side==='armL'?clip?.left:clip?.right)?.clone()??new T.Vector3(side==='armL'?-.19:.19,1.12,-.45);hand.y-=.32-pose.pull*.16;hand.z-=pose.reach*.08-pose.pull*.22;hand.x+=pose.twist*(side==='armL'?-.025:.025);grip(arm,hand,side==='armL'?-1:1);}return;}
  if(p.heldPart&&p.hp){mount.visible=star.visible=false;const remaining=(root.userData.partSwingUntil??0)-now,progress=remaining>0&&remaining<=800?1-remaining/800:0,clip=sampleCombatHands('swing',progress),swing=Math.sin(progress*Math.PI);for(const side of ['armL','armR'] as const){if(hasLost(p,side))continue;const arm=arms[side];if(!arm)continue;const hand=(side==='armL'?clip?.left:clip?.right)?.clone()??new T.Vector3(side==='armL'?-.04:.19,1.13+swing*.15,-.30-swing*.18);grip(arm,hand,side==='armL'?-1:1);}return;}
  if(p.carriedCorpse&&available<2){mount.visible=star.visible=false;const side=hasLost(p,'armL')?'armR':'armL',arm=arms[side];if(arm)grip(arm,new T.Vector3(side==='armL'?-.12:.12,1.28,-.5),side==='armL'?-1:1);return;}
  const throwArm=hasLost(p,'armR')?arms.armL:arms.armR;if(star.visible&&throwArm){throwArm.hand.getWorldPosition(target);root.worldToLocal(target);star.position.copy(target);star.rotation.set(0,Math.PI/2,0);star.scale.setScalar(.65);}
  if(!mount.visible)return;
  textured(p.weapon,p.team);
  if(previousWeapon!==p.weapon){previousWeapon=p.weapon;changedAt=now;}
  const crawl=isCrawling(p),transition=Math.max(0,1-(now-changedAt)/260),reloading=p.reloadAt>now,recoil=Math.exp(-Math.max(0,now-(p.fireAt-weapons[p.weapon].interval))/75)*Number(p.fireAt>0);
  mount.position.set(hasLost(p,'armR')?-.14:.14,crawl?1.48:p.crouching?.88:p.sprinting?1.03:1.19,(crawl?.06:-.26)+recoil*.035);mount.position.y-=Math.sin(transition*Math.PI)*.12;
  mount.rotation.set((crawl?Math.PI/2:0)+p.pitch-(p.sprinting?.28:0)-(reloading?.25:0)-recoil*.055,0,reloading?.18:0);
  models.forEach((model,index)=>model.visible=index===p.weapon);
  // updateMatrix is explicit: the IK targets must match this frame's weapon pose.
  for(const arm of Object.values(arms))if(arm)root.worldToLocal(arm.upper.getWorldPosition(arm.shoulder));
  for(let iteration=0;iteration<4;iteration++)for(const side of ['armR','armL'] as const){const arm=arms[side];if(!arm||hasLost(p,side)||p.carriedCorpse&&side==='armL')continue;mount.updateMatrix();localGrip.set(0,side==='armR'||hasLost(p,'armR')?.025:.015,side==='armR'||hasLost(p,'armR')?.035:weapons[p.weapon].kind==='pistol'?-.025:-.22).applyMatrix4(mount.matrix);offset.copy(arm.shoulder).sub(localGrip);const distance=offset.length();if(distance>arm.reach)mount.position.addScaledVector(offset,(distance-arm.reach)/distance);}
  mount.updateMatrix();right.set(0,.025,.035).applyMatrix4(mount.matrix);left.set(0,.015,weapons[p.weapon].kind==='pistol'?-.025:-.22).applyMatrix4(mount.matrix);
  for(const side of ['armR','armL'] as const){if(hasLost(p,side))continue;const arm=arms[side];if(arm){let point=side==='armR'&&!hasLost(p,'armR')?right:hasLost(p,'armR')?right:left;if(p.carriedCorpse&&side==='armL'){const clip=sampleCombatHands('carry',(time/1800)%1);point=clip?.left.clone().lerp(new T.Vector3(-.12,1.28,-.48),.65)??new T.Vector3(-.12,1.28,-.48);}grip(arm,point,side==='armL'?-1:1);}}
  for(const finger of fingers){const digit=Number(finger.name[6]),joint=Number(finger.name[8]),side=finger.name.endsWith('.L')?1:-1;finger.rotation.set(digit===1?.15:digit===2&&joint===1?.15:joint===1?.55:1.15,0,digit===1?side*.5:0);}
  for(const finger of bonusFingers)finger.bone.quaternion.copy(finger.rest).multiply(rotation.setFromAxisAngle(axis.set(0,0,1),finger.angle));
 },dispose(){disposed=true;mount.removeFromParent();star.removeFromParent();for(const entry of worldModels.values())entry.release();worldModels.clear();for(const geometry of geometries)geometry.dispose();starGeometry.dispose();for(const material of authoredMaterials)material.dispose();for(const material of [metal,wood,polymer,starMaterial])material.dispose();}};
}
