import * as T from 'three';
import type {MapId} from '../shared/world';

type Point=[number,number,number];

/** Opaque baked masonry bays and pitched rooflines beyond the playable district. */
export function createPeriodQuarter(id:Extract<MapId,'cologne'|'frontline'>,loader=new T.TextureLoader()){
  const cologne=id==='cologne',position:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[];
  let seed=cologne?1938:1944;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function face(points:Point[],tile:number,shade=1){
    const first=position.length/3,u0=(tile%4+.016)/4,v0=(3-Math.floor(tile/4)+.016)/4,span=.968/4;
    for(let i=0;i<points.length;i++){
      const u=i===1?1:i===2?(points.length===3?.5:1):0,v=i>1?1:0;
      position.push(...points[i]);uv.push(u0+span*u,v0+span*v);colors.push(shade,shade,shade);
    }
    indices.push(first,first+1,first+2);
    if(points.length===4)indices.push(first,first+2,first+3);
  }
  function groundRect(x0:number,x1:number,z0:number,z1:number,y:number,tile=12){
    face([[x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0]],tile);
  }
  const reach=405;
  if(cologne){
    // Continue both quays and the water channel through the outer town.
    for(const side of [-1,1]){
      const [x0,x1]=side===1?[30,reach]:[-reach,-30];
      groundRect(side===1?76:-reach,side===1?reach:-76,-75,75,-.08);
      groundRect(x0,x1,-reach,-75,-.08);groundRect(x0,x1,75,reach,-.08);
      const x=side*30;
      for(let z=-reach;z<reach;z+=15){
        const a=side===1?z:z+15,b=side===1?z+15:z;
        face([[x,-5,a],[x,-5,b],[x,-.10,b],[x,-.10,a]],14,.88);
      }
    }
    groundRect(-30,30,210,reach,-4.09,13);groundRect(-30,30,-reach,-210,-4.09,13);
  }else{
    const edge=119;
    groundRect(-reach,-edge,-reach,reach,-1.0);groundRect(edge,reach,-reach,reach,-1.0);
    groundRect(-edge,edge,-reach,-edge,-1.0);groundRect(-edge,edge,edge,reach,-1.0);
  }
  function chimney(x:number,z:number,y:number,height:number,r:number,tile:number){
    const corners:Point[]=[[x-r,y,z+r],[x+r,y,z+r],[x+r,y,z-r],[x-r,y,z-r]];
    for(let j=0;j<4;j++){
      const a=corners[j],b=corners[(j+1)%4];
      face([a,b,[b[0],height,b[2]],[a[0],height,a[2]]],tile,.94);
    }
    groundRect(x-r,x+r,z-r,z+r,height,tile);
  }
  function house(cx:number,cz:number,width:number,depth:number,floors:number,sideways:boolean,factory:boolean){
    const w=width/2,d=depth/2,y=-.9,h=y+floors*(factory?3.8:3.05),rise=factory?1.7:2.1+random()*2.2;
    const facade=factory?4+Math.floor(random()*3):Math.floor(random()*4);
    const roof=factory?15:random()<.45?8:9,tone=.82+.18*random();
    const flip=sideways?-1:1;
    function pt(x:number,height:number,z:number):Point{
      return sideways?[cx+z,height,cz-x]:[cx+x,height,cz+z];
    }
    function wall(x0:number,z0:number,x1:number,z1:number,finish:number){
      const bays=Math.max(1,Math.round(Math.hypot(x1-x0,z1-z0)/(factory?4.5:3.35)));
      for(let j=0;j<bays;j++){
        const a=j/bays,b=(j+1)/bays;
        for(let k=0;k<floors;k++){
          const bottom=y+(h-y)*k/floors,top=y+(h-y)*(k+1)/floors;
          face([pt(x0+(x1-x0)*a,bottom,z0+(z1-z0)*a),pt(x0+(x1-x0)*b,bottom,z0+(z1-z0)*b),
            pt(x0+(x1-x0)*b,top,z0+(z1-z0)*b),pt(x0+(x1-x0)*a,top,z0+(z1-z0)*a)],facade,tone*finish);
        }
      }
    }
    wall(-w,d,w,d,1);wall(w,d,w,-d,.91);wall(w,-d,-w,-d,.87);wall(-w,-d,-w,d,.95);
    const hip=!factory&&random()<.35?Math.min(w*.55,d*.85):0;
    for(const side of [-1,1]){
      const e=d*side,ridgeY=h+rise;
      const x=w*side;
      face([pt(-x,h,e),pt(x,h,e),pt((w-hip)*side,ridgeY,0),pt(-(w-hip)*side,ridgeY,0)],roof,tone*(side*flip===1?.98:.82));
      face([pt(x,h,e),pt(x,h,-e),pt((w-hip)*side,ridgeY,0)],hip?roof:factory?10:11,tone*.90);
    }
    if(random()<.72){
      const top=pt((random()-.5)*w,h+rise*.66,-d*.27);
      chimney(top[0],top[2],top[1]-.28,top[1]+1.7,.40,10);
    }
  }
  const layers=cologne?[100,164,224]:[145,196,249];
  for(const [tier,distance] of layers.entries())for(const alongX of [false,true])for(const side of [-1,1]){
    // The freight map already owns the first row of workers' terraces to the north and south.
    if(!cologne&&tier===0&&alongX)continue;
    let cursor=-distance+3;
    while(cursor<distance-6){
      const factory=!cologne&&random()<.40;
      const width=(factory?18:11)+random()*(factory?10:7),depth=9+random()*4;
      const span=cursor+width/2;cursor+=width+(random()<.20?5+random()*5:.35+random()*1.0);
      const shift=side*(distance+random()*7);
      const x=alongX?span:shift,z=alongX?shift:span;
      if(cologne&&(Math.abs(x)-(alongX?width:depth)/2<32||Math.abs(x+88)<23&&Math.abs(z+45)<23))continue;
      const levels=(factory?2:2+tier%2)+Math.floor(random()*(factory?2:3));
      house(x,z,width,depth,levels,!alongX,factory);
      if(factory&&random()<.085)chimney(x+depth*.35,z+width*.27,-1,19+random()*10,.95,10);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const map=loader.load('/shooter/environment/period-quarter.webp');map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const mesh=new T.Mesh(geometry,new T.MeshLambertMaterial({map,vertexColors:true}));
  mesh.name='Outer quarter and embankments';mesh.matrixAutoUpdate=false;return mesh;
}
