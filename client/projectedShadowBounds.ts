import {Camera,Frustum,Vector2,Vector3} from 'three';

function cross(a:Vector2,b:Vector2,c:Vector2){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

/** Fit the light's map to the projected receiver footprint. Light depth stays unbounded for the fit. */
export function createShadowMapFootprint(){
  const projected=Array.from({length:8},()=>new Vector2()),point=new Vector3();
  const hull:Vector2[]=[];
  const firstClip=Array.from({length:14},()=>new Vector2()),secondClip=firstClip.map(()=>new Vector2());
  const clipped=new Frustum();
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  function trim(input:Vector2[],count:number,output:Vector2[],axis:'x'|'y',limit:number,side:number){
    if(!count)return 0;
    let saved=0,previous=input[count-1],previousDepth=(previous[axis]-limit)*side;
    for(let i=0;i<count;i++){
      const next=input[i],depth=(next[axis]-limit)*side;
      if((previousDepth>=0)!==(depth>=0)){
        output[saved++].lerpVectors(previous,next,previousDepth/(previousDepth-depth));
      }
      if(depth>=0)output[saved++].copy(next);
      previous=next;previousDepth=depth;
    }
    return saved;
  }
  function include(camera:Camera,light:Frustum,span:number,pad:number){
    let count=0;
    for(let x=-1;x<=1;x+=2)for(let y=-1;y<=1;y+=2)for(let z=-1;z<=1;z+=2){
      point.set(x,y,z).unproject(camera);
      projected[count++].set(light.planes[1].distanceToPoint(point),light.planes[2].distanceToPoint(point));
    }
    projected.sort((p,q)=>p.x-q.x||p.y-q.y);
    hull.length=0;
    for(const p of projected){
      while(hull.length>=2&&cross(hull.at(-2)!,hull.at(-1)!,p)<=0)hull.pop();
      hull.push(p);
    }
    const lowerSize=hull.length;
    for(let i=projected.length-2;i>=0;i--){
      const p=projected[i];
      while(hull.length>lowerSize&&cross(hull.at(-2)!,hull.at(-1)!,p)<=0)hull.pop();
      hull.push(p);
    }
    count=trim(hull,hull.length-1,firstClip,'x',-pad,1);
    count=trim(firstClip,count,secondClip,'x',span+pad,-1);
    count=trim(secondClip,count,firstClip,'y',-pad,1);
    count=trim(firstClip,count,secondClip,'y',span+pad,-1);
    for(let i=0;i<count;i++){
      const p=secondClip[i];
      minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
      minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
    }
  }
  return (light:Frustum,camera:Camera,weapon:Camera|undefined,padding:number,span:number)=>{
    clipped.copy(light);
    minX=minY=Infinity;maxX=maxY=-Infinity;
    include(camera,light,span,padding);
    if(weapon)include(weapon,light,span,padding);
    if(minX===Infinity)return clipped;
    clipped.planes[0].constant-=Math.max(0,span-maxX-padding);
    clipped.planes[1].constant-=Math.max(0,minX-padding);
    clipped.planes[2].constant-=Math.max(0,minY-padding);
    clipped.planes[3].constant-=Math.max(0,span-maxY-padding);
    return clipped;
  };
}
