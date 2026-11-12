// Shared convex rock hull: rendering, movement, landing and hits use the same planes.
// No renderer dependency: this module runs on both the authoritative server and client.
export type RockBounds = { x: number; y: number; z: number; w: number; h: number; d: number };
export type Vec3 = [number, number, number];
export type RockPlane = { normal: Vec3; offset: number };
export type RockHull = { planes: RockPlane[]; vertices: Vec3[]; faces: number[][] };
const cache = new WeakMap<RockBounds, RockHull>();
const dot = (a: number[], b: number[]) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: number[], b: number[]): Vec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = (v: Vec3): Vec3 => { const length=Math.hypot(...v); return v.map(n=>n/length) as Vec3; };

export function rockHull(b: RockBounds): RockHull {
  const existing=cache.get(b); if(existing)return existing;
  const planes: RockPlane[]=[];
  const plane=(normal:Vec3,offset:number)=>{const length=Math.hypot(...normal);planes.push({normal:unit(normal),offset:offset/length});};
  plane([0,-1,0],b.h/2); plane([0,1,0],b.h*.46);
  for(const side of [-1,1]){plane([side,0,0],b.w/2);plane([0,0,side],b.d/2);}
  for(let i=0;i<12;i++){
    const angle=(i+.13)*Math.PI/6,x=Math.cos(angle),z=Math.sin(angle);
    const variation=Math.sin(b.x*1.73+b.z*.63+i*7.1)*.045;
    plane([x/b.w,(.16+variation*2)/b.h,z/b.d],.43+variation);
    plane([x*.7/b.w,1/b.h,z*.7/b.d],.39+variation);
  }
  const vertices:Vec3[]=[];
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
    const a=planes[i],c=planes[j],d=planes[k],bc=cross(c.normal,d.normal),det=dot(a.normal,bc);
    if(Math.abs(det)<1e-8)continue;
    const ca=cross(d.normal,a.normal),ab=cross(a.normal,c.normal);
    const v=bc.map((n,axis)=>(n*a.offset+ca[axis]*c.offset+ab[axis]*d.offset)/det) as Vec3;
    if(planes.some(p=>dot(p.normal,v)>p.offset+1e-6))continue;
    if(!vertices.some(p=>Math.hypot(...p.map((n,axis)=>n-v[axis]))<1e-5))vertices.push(v);
  }
  const faces:number[][]=[];
  for(const p of planes){
    const face=vertices.map((v,i)=>Math.abs(dot(p.normal,v)-p.offset)<1e-5?i:-1).filter(i=>i>=0);
    if(face.length<3)continue;
    const center:Vec3=[0,0,0];for(const i of face)for(let a=0;a<3;a++)center[a]+=vertices[i][a]/face.length;
    const u=unit(cross(Math.abs(p.normal[1])<.9?[0,1,0]:[1,0,0],p.normal)),v=cross(p.normal,u);
    face.sort((a,b)=>{
      const x=vertices[a].map((n,i)=>n-center[i]),y=vertices[b].map((n,i)=>n-center[i]);
      return Math.atan2(dot(x,v),dot(x,u))-Math.atan2(dot(y,v),dot(y,u));
    });
    faces.push(face);
  }
  const result={planes,vertices,faces};cache.set(b,result);return result;
}

export function rockBlocks(b:RockBounds,x:number,bottom:number,z:number,height:number,radius:number) {
  if(Math.abs(x-b.x)>b.w/2+radius||Math.abs(z-b.z)>b.d/2+radius||bottom>=b.y+b.h/2)return false;
  return rockHull(b).planes.every(p=>{
    const [nx,ny,nz]=p.normal;
    const y=(ny>=0?bottom+.04:bottom+height-.04)-b.y;
    return nx*(x-b.x)+ny*y+nz*(z-b.z)<p.offset+radius*Math.hypot(nx,nz)-1e-6;
  });
}

export function rockSurface(b:RockBounds,x:number,z:number) {
  let top=Infinity,bottom=-Infinity;
  for(const {normal:[nx,ny,nz],offset} of rockHull(b).planes){
    const rest=offset-nx*(x-b.x)-nz*(z-b.z);
    if(Math.abs(ny)<1e-8&&rest<0)return -Infinity;
    if(ny>1e-8)top=Math.min(top,b.y+rest/ny);
    if(ny< -1e-8)bottom=Math.max(bottom,b.y+rest/ny);
  }
  return top>=bottom?top:-Infinity;
}

export function rayRock(b:RockBounds,origin:number[],direction:number[]) {
  let near=0,far=150;
  const local=[origin[0]-b.x,origin[1]-b.y,origin[2]-b.z];
  for(const p of rockHull(b).planes){
    const distance=p.offset-dot(p.normal,local),slope=dot(p.normal,direction);
    if(Math.abs(slope)<1e-8){if(distance<0)return Infinity;continue;}
    const t=distance/slope;
    if(slope<0)near=Math.max(near,t);else far=Math.min(far,t);
    if(near>far)return Infinity;
  }
  return near;
}
