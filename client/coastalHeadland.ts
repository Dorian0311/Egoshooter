import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const islandHeadlands=[
      [176,-70,36,34,21], [153,-109,24,23,16], [123,-145,18,15,13],
      [-151,-109,33,28,18], [-183,-64,39,44,24], [-165,54,26,19,18],
      [-85,163,33,32,25], [133,146,32,39,23], [163,112,19,18,14],
] as const;
const sectors=40;

/** Paint the intertidal band on both the terrain shell and the fitted scans. */
export function shoreRockFinish(material:T.MeshStandardMaterial){
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCliffWorld;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvCliffWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCliffWorld;')
   .replace('#include <color_fragment>',`#include <color_fragment>
    float aboveSea=vCliffWorld.y+3.4;
    float rockGrain=.5+.5*sin(dot(vCliffWorld.xz,vec2(.66,.49))+vCliffWorld.y*1.3);
    float spray=1.0-smoothstep(.12,1.72,aboveSea+rockGrain*.34);
    float algae=(1.0-smoothstep(.09,.83,abs(aboveSea-.25)))*(.26+.74*rockGrain);
    float stratum=.5+.5*sin(vCliffWorld.y*.48+vCliffWorld.z*.17+vCliffWorld.x*.11);
    diffuseColor.rgb*=mix(vec3(.89+.18*stratum),vec3(.55,.63,.55),spray);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.71,1.17,.76),algae*.56);
   `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    roughnessFactor=mix(roughnessFactor,roughnessFactor*.65,spray);
   `);
 };
 material.customProgramCacheKey=()=>'coastal-cliff-intertidal-v1';
 return material;
}

// A closed, terraced sea cliff. Its crown, exposed rock and wet base share a
// silhouette so the colour bands follow the folds of the headland.
export function coastalHeadland(seed:number){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const sections=sectors,stone=new T.Color(),rim=new T.Color();
 const rings=[
  {radius:1.04,height:-.16,color:'#7f9b97'},
  {radius:1,height:.13,color:'#bbc3bd'},
  {radius:.91,height:.5,color:'#eee9df'},
  {radius:.88,height:.72,color:'#f5ebd8'},
  {radius:.79,height:.79,color:'#a0b48b'},
  {radius:.59,height:.95,color:'#96b074'},
  {radius:.30,height:1,color:'#96af7c'},
 ];
 for(const [row,ring] of rings.entries()){
  for(let i=0;i<sections;i++){
   const a=i/sections*Math.PI*2;
   const fold=.12*Math.sin(3*a+seed)+.09*Math.cos(5*a-seed)+.055*Math.sin(9*a+.4);
   const radius=ring.radius*(1+fold);
   const crest=1+.25*Math.sin(2*a+seed)+.11*Math.cos(5*a-seed);
   positions.push(radius*Math.cos(a),ring.height*crest,radius*Math.sin(a));
   stone.set(ring.color).multiplyScalar(.94+.08*Math.sin(a*4+seed));
   colors.push(stone.r,stone.g,stone.b);
   if(row){
    const lower=(row-1)*sections+i,next=(row-1)*sections+(i+1)%sections;
    indices.push(lower,lower+sections,next,next,lower+sections,next+sections);
   }
  }
 }
 const peak=positions.length/3;positions.push(0,1.04,0);rim.set('#87aa68');colors.push(rim.r,rim.g,rim.b);
 for(let i=0;i<sections;i++)indices.push(peak,(rings.length-1)*sections+(i+1)%sections,(rings.length-1)*sections+i);
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Unwrap each cliff around its folds in metres. Split the UV seam while retaining smooth normals. */
export function texturedHeadland(index:number){
 const [, , width,height,depth]=islandHeadlands[index];
 const shell=coastalHeadland(index*1.7),surface=shell.toNonIndexed();
 shell.dispose();
 const p=surface.getAttribute('position'),uv=new Float32Array(p.count*2);
 const period=11,turns=Math.max(1,Math.round(Math.PI*(width+depth)/period));
 for(let i=0;i<p.count;i+=3){
  const angles=[0,1,2].map(k=>Math.atan2(p.getZ(i+k),p.getX(i+k))/(2*Math.PI));
  const seam=Math.max(...angles)-Math.min(...angles)>.5;
  for(let k=0;k<3;k++){
   const v=i+k,x=p.getX(v)*width,y=p.getY(v)*height,z=p.getZ(v)*depth;
   if(i>=4*sectors*6){ // Project the sloping crown from above.
    uv[2*v]=x/period;uv[2*v+1]=z/period;
   }else{
    uv[2*v]=(angles[k]+(seam&&angles[k]<0?1:0))*turns+index*.37;
    uv[2*v+1]=(y-.2*Math.hypot(x,z))/period;
   }
  }
 }
 surface.setAttribute('uv',new T.BufferAttribute(uv,2));
 return surface;
}

/** Drape the scan across the sea-facing terraces, retaining its local relief and baked UVs. */
export function scannedCliffFaces(scan:T.BufferGeometry){
 scan.computeBoundingBox();
 const bounds=scan.boundingBox!,size=bounds.getSize(new T.Vector3()),patches:T.BufferGeometry[]=[];
 const elevations=[-.16,.13,.5,.72,.79,.95,1];
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),point=new T.Vector3();
 for(const index of [0,4,7]){
  const [cx,cz,width,height,depth]=islandHeadlands[index],yaw=index*.87;
  const cs=Math.cos(yaw),sn=Math.sin(yaw);
  const bearing=Math.atan2((-cx*sn-cz*cs)/depth,(-cx*cs+cz*sn)/width);
  const shell=coastalHeadland(index*1.7),hull=shell.getAttribute('position');
  const patch=scan.clone(),vertices=patch.getAttribute('position');
  for(let i=0;i<vertices.count;i++){
   const u=(vertices.getX(i)-bounds.min.x)/size.x,v=(vertices.getY(i)-bounds.min.y)/size.y;
   const z=vertices.getZ(i),angle=bearing+(1-2*u)*(index===4?1.08:.94);
   const column=sectors*((angle/(2*Math.PI)+2)%1),j=Math.floor(column),t=column-j,k=(j+1)%sectors;
   const h=-.01+v*.77;
   let row=0;while(elevations[row+1]<h)row++;
   const f=(h-elevations[row])/(elevations[row+1]-elevations[row]),lo=row*sectors,hi=lo+sectors;
   // Match the actual two triangles per terrace cell; a radial approximation leaves gaps near folds.
   if(t+f<=1){
    a.fromBufferAttribute(hull,lo+j);b.fromBufferAttribute(hull,lo+k);c.fromBufferAttribute(hull,hi+j);
    point.copy(a).multiplyScalar(1-t-f).addScaledVector(b,t).addScaledVector(c,f);
   }else{
    a.fromBufferAttribute(hull,hi+k);b.fromBufferAttribute(hull,lo+k);c.fromBufferAttribute(hull,hi+j);
    point.copy(a).multiplyScalar(t+f-1).addScaledVector(b,1-f).addScaledVector(c,1-t);
   }
   // Bury the scanned perimeter gradually. No alpha blend or second layer of shadows is needed.
   const border=Math.min(1,u*13,(1-u)*13,v*18,(1-v)*18);
   const relief=(z-bounds.min.z)*.24*border-.26*(1-border);
   const localX=point.x*width+Math.cos(angle)*relief,localZ=point.z*depth+Math.sin(angle)*relief;
   vertices.setXYZ(i,cx+cs*localX+sn*localZ,-4+point.y*height,cz-sn*localX+cs*localZ);
  }
  patch.computeVertexNormals();patches.push(patch);shell.dispose();
 }
 const geometry=mergeGeometries(patches);patches.forEach(p=>p.dispose());
 if(!geometry)throw new Error('Coastal scan geometry could not be merged');
 geometry.computeBoundingSphere();return geometry;
}
