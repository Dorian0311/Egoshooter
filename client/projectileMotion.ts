import * as T from 'three';
const forward=new T.Vector3(),up=new T.Vector3(),normal=new T.Vector3(),basis=new T.Matrix4(),spin=new T.Quaternion();
/** The star spins about its own normal; its cutting plane stays along the flight path. */
export function throwingStarQuaternion(velocity:{vx:number;vy:number;vz:number},age:number,target=new T.Quaternion()){
 forward.set(velocity.vx,velocity.vy,velocity.vz).normalize();if(forward.lengthSq()<.1)forward.set(0,0,-1);
 up.set(0,1,0).addScaledVector(forward,-forward.y);if(up.lengthSq()<.01)up.set(1,0,0).addScaledVector(forward,-forward.x);up.normalize();normal.crossVectors(forward,up).normalize();
 basis.makeBasis(forward,up,normal);target.setFromRotationMatrix(basis);return target.multiply(spin.setFromAxisAngle(new T.Vector3(0,0,1),age*85));
}
