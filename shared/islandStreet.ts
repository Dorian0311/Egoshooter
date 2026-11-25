// Fronts face the carriageway. The same dimensions drive rendering and collision.
export const islandShops=[
  {id:'diner',x:63,z:-34.8,w:14,h:4.5,d:8,front:1},
  {id:'harbour-supply',x:51,z:-11,w:12,h:5.2,d:8,front:-1},
  {id:'coast-records',x:75,z:-11,w:13,h:4.3,d:8,front:-1},
] as const;
type Shop=typeof islandShops[number];
type Part='side'|'back'|'sign'|'sill'|'post'|'roof'|'bench'|'table'|'counter'|'rack'|'bin';
export function shopParts(s:Shop){
  const parts:{role:Part;x:number;y:number;z:number;w:number;h:number;d:number}[]=[];
  function add(role:Part,x:number,y:number,z:number,w:number,h:number,d:number){
    parts.push({role,x:s.x+x,y,z:s.z+s.front*z,w,h,d});
  }
  const top=s.h*.68,opening=2.1,wing=(s.w-opening)/2;
  add('roof',0,s.h+.04,0,s.w+.25,.13,s.d+.24);
  add('back',0,s.h/2,-s.d/2+.12,s.w,s.h,.24);
  add('sign',0,(top+s.h)/2,s.d/2-.12,s.w,s.h-top,.24);
  for(const side of [-1,1]){
    add('side',side*(s.w/2-.12),s.h/2,0,.24,s.h,s.d);
    add('sill',side*(opening+wing)/2,.48,s.d/2-.12,wing,.96,.24);
    add('post',side*(opening/2+.07),top/2,s.d/2-.12,.14,top,.24);
  }
  if(s.id==='diner'){
    for(const x of [-4.7,-2.55])add('bench',x,.44,-.65,.64,.88,2.1);
    add('table',-3.62,.54,-.65,.94,1.08,1.72);
    add('counter',4,.60,-1.15,2.8,1.20,1);
  }else{
    for(const side of [-1,1])add(s.id==='harbour-supply'?'rack':'bin',side*(s.w/2-1.1),s.id==='harbour-supply'?1.05:.55,-.45,1,s.id==='harbour-supply'?2.1:1.1,3.8);
    add('counter',2,.56,-2.75,2.7,1.12,.78);
  }
  return parts;
}
export const streetPoles=[34,55,76,92] as const;
export const inIslandStreet=(x:number,z:number)=>x>=30&&x<=96&&z>=-40&&z<=-6;
