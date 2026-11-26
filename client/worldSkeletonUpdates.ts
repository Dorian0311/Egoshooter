import {SkinnedMesh,type Object3D,type Skeleton} from 'three';

/** Three's colour projection and shadow submission use different renderer frame IDs.
 * A registered world rig has one pose throughout this synchronous world pass. */
export function createWorldSkeletonUpdates(){
 let pass=0,active=false;
 const entries=new WeakMap<Skeleton,{references:number;restore:()=>void}>();
 return {
  begin(){pass++;active=true;},
  end(){active=false;},
  register(root:Object3D){
   const skeletons=new Set<Skeleton>();
   root.traverse(object=>{if(object instanceof SkinnedMesh)skeletons.add(object.skeleton);});
   for(const skeleton of skeletons){
    const previous=entries.get(skeleton);
    if(previous){previous.references++;continue;}
    const update=skeleton.update,own=Object.getOwnPropertyDescriptor(skeleton,'update');
    let lastPass=-1;
    function updatePose(this:Skeleton){
     if(active&&lastPass===pass)return;
     update.call(this);
     if(active)lastPass=pass;
    }
    skeleton.update=updatePose;
    entries.set(skeleton,{references:1,restore(){
     if(skeleton.update!==updatePose)return;
     if(own)Object.defineProperty(skeleton,'update',own);
     else Reflect.deleteProperty(skeleton,'update');
    }});
   }
   return ()=>{
    for(const skeleton of skeletons){
     const entry=entries.get(skeleton)!;
     if(--entry.references===0){entry.restore();entries.delete(skeleton);}
    }
    skeletons.clear();
   };
  },
 };
}
