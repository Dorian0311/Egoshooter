// Fronts face the carriageway. The same dimensions drive rendering and collision.
export const islandShops=[
  {x:63,z:-34.8,w:14,h:4.5,d:8,front:1},
  {x:51,z:-11,w:12,h:5.2,d:8,front:-1},
  {x:75,z:-11,w:13,h:4.3,d:8,front:-1},
] as const;
export const streetPoles=[34,55,76,92] as const;
export const inIslandStreet=(x:number,z:number)=>x>=30&&x<=96&&z>=-40&&z<=-6;
