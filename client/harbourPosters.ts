import * as T from 'three';
import {islandShops} from '../shared/islandStreet';

/** Notices on the rear plaster bays, between each shop's framed print and centre sign. */
export function createHarbourPosters(loader:T.TextureLoader){
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const halfWidth=.52,halfHeight=halfWidth*900/640,eyeLevel=1.98;
  for(const [i,shop] of islandShops.entries()){
    const x=shop.x-2.43,z=shop.z-shop.front*(shop.d/2-.247);
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
      positions.push(x+(2*u-1)*halfWidth*shop.front,eyeLevel+(2*v-1)*halfHeight,z);
      uv.push((i+(u*(640-2)+1)/640)/3,(v*(900-2)+1)/900);
    }
    const base=i*4;
    indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const map=loader.load('/shooter/island-street/harbour-posters.webp');
  map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const posters=new T.Mesh(geometry,new T.MeshStandardMaterial({map,roughness:.94}));
  posters.name='Harbour Road printed notices';posters.receiveShadow=true;
  return posters;
}
