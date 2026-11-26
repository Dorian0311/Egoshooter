import * as T from 'three';

/** The clips ground the ankle. Roll the long boot sole onto its toe or heel
 * before it intersects the actor's support plane. No raycast or gameplay pose change. */
export function bootGroundContact(){
 const boots:{boot:T.Group;foot:T.Bone;rest:T.Vector3}[]=[];
 const world=new T.Quaternion(),inverse=new T.Quaternion(),level=new T.Quaternion(),offset=new T.Quaternion();
 const ankle=new T.Vector3(),scale=new T.Vector3(),point=new T.Vector3(),up=new T.Vector3(0,1,0);
 // Support points on the authored sole in boot space (toe narrows at the front).
 const sole=[[-.062,.002,.025],[.062,.002,.025],[-.065,.002,-.18],[.065,.002,-.18],[-.04,.002,-.254],[.04,.002,-.254],[0,.002,-.275]];
 function bottom(rest:T.Vector3,rotation:T.Quaternion){
  let low=Infinity;
  for(const [x,y,z] of sole){
   point.set(x,y,z).add(rest).applyQuaternion(rotation);
   low=Math.min(low,point.y);
  }
  return ankle.y+low;
 }
 return {
  add(boot:T.Group,foot:T.Bone){boots.push({boot,foot,rest:boot.position.clone()});},
  update(floor:number,active:boolean,yaw:number){
   for(const {boot,foot,rest} of boots){
    boot.quaternion.identity();boot.position.copy(rest);
    if(!active)continue;
    foot.updateWorldMatrix(true,false);ankle.setFromMatrixPosition(foot.matrixWorld);
    if(ankle.y-floor>.40)continue;
    foot.matrixWorld.decompose(ankle,world,scale);
    inverse.copy(world).invert();
    // Keep the planted sole level in its travel heading. Release the toes
    // continuously as the ankle rises, rather than snapping at contact.
    level.setFromAxisAngle(up,yaw);
    world.slerp(level,1-T.MathUtils.smoothstep(ankle.y-floor,.13,.39));
    const low=bottom(rest,world);
    offset.copy(inverse).multiply(world);
    boot.quaternion.copy(offset);boot.position.copy(rest).applyQuaternion(offset);
    const lift=T.MathUtils.clamp(floor-low,0,.028);
    boot.position.add(point.copy(up).applyQuaternion(inverse).multiplyScalar(lift));
   }
  },
 };
}
