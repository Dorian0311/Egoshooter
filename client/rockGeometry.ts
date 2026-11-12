import * as T from 'three';
import {rockHull,type RockBounds} from '../shared/rocks.ts';

export function createRockGeometry(bounds:RockBounds) {
  const hull=rockHull(bounds),positions:number[]=[],uvs:number[]=[],colors:number[]=[];
  const color=new T.Color();
  for(const face of hull.faces){
    const a=new T.Vector3(...hull.vertices[face[0]]),b=new T.Vector3(...hull.vertices[face[1]]),c=new T.Vector3(...hull.vertices[face[2]]);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const axis=Math.abs(normal.y)>.6?'top':Math.abs(normal.x)>Math.abs(normal.z)?'side':'front';
    for(let i=1;i<face.length-1;i++)for(const index of [face[0],face[i],face[i+1]]){
      const [x,y,z]=hull.vertices[index];positions.push(x,y,z);
      uvs.push((axis==='side'?z:x)/2.8,(axis==='top'?z:y)/2.8);
      const snow=T.MathUtils.smoothstep(normal.y,.45,.85)*T.MathUtils.smoothstep(y/bounds.h,-.05,.3);
      color.set('#a1a5a1').lerp(new T.Color('#f4f5f0'),snow);
      colors.push(color.r,color.g,color.b);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
