import * as T from 'three';

const capacity=72;
const shardsPerPane=12;
const shardLifetime=1.4;
type Point=readonly [number,number,number];

/** Window debris shares one opaque draw, even when several panes break together. */
export function createGlassShards(parent:T.Object3D){
  const geometry=new T.TetrahedronGeometry(.06);
  const material=new T.MeshStandardMaterial({color:'#b4d4cc',roughness:.24,metalness:.12});
  const mesh=new T.InstancedMesh(geometry,material,capacity);
  mesh.name='window-glass-shards';mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  parent.add(mesh);
  const particles=Array.from({length:capacity},()=>({
    position:new T.Vector3(),velocity:new T.Vector3(),time:0,spin:0,size:1,
  }));
  const pose=new T.Object3D();
  let count=0;
  return {
    emit(point:Point){
      for(let i=0;i<shardsPerPane&&count<capacity;i++){
        const shard=particles[count++];
        shard.position.set(...point);
        shard.velocity.set(Math.sin(i*7)*2,Math.cos(i)*2,Math.cos(i*7)*2);
        shard.time=shardLifetime;
        shard.spin=(i%2===0?1:-1)*(2+i*.16);
        shard.size=.60+(i%5)*.17;
      }
    },
    update(dt:number){
      let live=0;
      for(let i=0;i<count;i++){
        const shard=particles[i];
        shard.time-=dt;
        if(shard.time<=0)continue;
        shard.velocity.y-=9.8*dt;
        shard.position.addScaledVector(shard.velocity,dt);
        const angle=(shardLifetime-shard.time)*shard.spin;
        pose.position.copy(shard.position);
        pose.rotation.set(angle,angle*.67,angle*.43);
        pose.scale.set(shard.size,shard.size*.71,shard.size*.44);
        pose.updateMatrix();
        mesh.setMatrixAt(live,pose.matrix);
        if(live!==i){
          particles[i]=particles[live];
          particles[live]=shard;
        }
        live++;
      }
      count=live;
      mesh.count=live;mesh.visible=live>0;
      if(live)mesh.instanceMatrix.needsUpdate=true;
    },
    dispose(){mesh.removeFromParent();mesh.dispose();geometry.dispose();material.dispose();},
  };
}
