import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Building} from '../shared/world';

/** Coastal depots share galvanized fittings. Each building is a single frustum-cullable draw. */
export function createCoastalArchitecture(buildings:readonly Building[]){
  const group=new T.Group();group.name='Coastal depot architecture';
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.77,metalness:.17});
  const shutterMaterial=material.clone();
  if(typeof document!=='undefined'){
    shutterMaterial.map=new T.TextureLoader().load('/shooter/environment/island-loading-shutters.webp');
    shutterMaterial.map.colorSpace=T.SRGBColorSpace;
    shutterMaterial.map.anisotropy=4;
  }
  const matrix=new T.Matrix4(),rotation=new T.Quaternion(),angles=new T.Euler();
  const position=new T.Vector3(),unit=new T.Vector3(1,1,1),color=new T.Color();
  const sheet='#667878',edge='#b0b5a5',soot='#485657',glass='#789a9a',rust='#886b50';
  for(const [index,b] of buildings.entries()){
    const pieces:T.BufferGeometry[]=[];
    const cap=b.upper?8.3:4.3,halfW=b.w/2,halfD=b.d/2;
    const loadingBay=b.upper&&b.name.startsWith('KÜSTENWACHE');
    const enamel=['#4e6f65','#597279','#7e7861','#676e64'][index%4];
    function piece(g:T.BufferGeometry,x:number,y:number,z:number,tint:string,rotX=0,rotZ=0){
      rotation.setFromEuler(angles.set(rotX,0,rotZ));
      g.applyMatrix4(matrix.compose(position.set(x,y,z),rotation,unit));
      const p=g.getAttribute('position'),rgb=new Float32Array(p.count*3);
      color.set(tint);
      for(let i=0;i<p.count;i++){
        // Oxidation varies across panels and catches lighter upward-facing edges.
        const patina=.90+.05*Math.sin(p.getX(i)*2.73+p.getZ(i)*.69)+.05*g.getAttribute('normal').getY(i);
        rgb[i*3]=color.r*patina;rgb[i*3+1]=color.g*patina;rgb[i*3+2]=color.b*patina;
      }
      g.setAttribute('color',new T.BufferAttribute(rgb,3));pieces.push(g);
      if(loadingBay){
        const uv=g.getAttribute('uv');
        for(let i=0;i<uv.count;i++)uv.setXY(i,.978,.5);
      }
    }
    function box(x:number,y:number,z:number,w:number,h:number,d:number,tint:string,rotX=0,rotZ=0){
      piece(new T.BoxGeometry(w,h,d),x,y,z,tint,rotX,rotZ);
    }
    function pipe(x:number,y:number,z:number,top:number,bottom:number,h:number,tint:string){
      piece(new T.CylinderGeometry(top,bottom,h,10),x,y,z,tint);
    }
    for(const side of [-1,1]){
      // Flashing around the roof slab, a continuous shadow line and hung eaves gutter.
      box(0,cap+.025,side*(halfD+.44),b.w+1.02,.12,.18,edge);
      box(side*(halfW+.44),cap+.025,0,.18,.12,b.d+.74,edge);
      box(0,cap-.13,side*(halfD+.54),b.w+.94,.14,.17,soot);
      box(side*(halfW+.50),cap-.11,0,.11,.13,b.d+.85,sheet);
      const drainX=side*(halfW-.55),drainZ=side*(halfD+.36);
      pipe(drainX,(cap-.28)/2+.09,drainZ,.10,.10,cap-.28,sheet);
      for(let y=.55;y<cap-.36;y+=1.85)pipe(drainX,y,drainZ,.119,.119,.075,rust);
      box(drainX,cap-.18,drainZ+side*.08,.25,.22,.35,soot);
      // Keep the side entrances and firing windows clear, including the central ground-level opening.
      const wallX=side*(halfW+.25);
      for(let floor=0;floor<(b.upper?2:1);floor++)for(const bay of [-1,1]){
        const z=bay*3.25,floorY=floor*4;
        box(wallX,floorY+1.16,z,.27,.12,3.5,edge);
        box(wallX,floorY+2.55,z,.17,.12,3.48,enamel);
        for(const end of [-1,1])box(wallX,floorY+1.85,z+end*1.71,.13,1.31,.075,enamel);
      }
      // A shallow entrance awning with brackets above the existing nameplate.
      const frontZ=side*(halfD+.79);
      box(0,3.99,frontZ,4.85,.105,1.18,enamel,side*.055);
      box(0,3.92,frontZ+side*.59,4.88,.16,.065,edge);
      for(const dx of [-2.03,2.03])box(dx,3.72,frontZ,.065,.068,1.13,soot,-side*.35);
      if(loadingBay){
        // The upper central bay is masonry; the playable openings below and on
        // the side elevations stay clear of the shutter and runner assembly.
        const shutter=new T.PlaneGeometry(3.56,3.19);
        if(side<0)shutter.rotateY(Math.PI);
        piece(shutter,0,6.10,side*(halfD+.265),'#faf9f1');
        const uv=shutter.getAttribute('uv'),x=(side>0?8:496);
        uv.setXY(0,(x+1)/1024,491/512);uv.setXY(1,(x+471)/1024,491/512);
        uv.setXY(2,(x+1)/1024,21/512);uv.setXY(3,(x+471)/1024,21/512);
        for(const xx of [-1.81,1.81]){
          box(xx,6.10,side*(halfD+.30),.16,3.32,.17,soot);
          box(xx+Math.sign(xx)*.045,6.10,side*(halfD+.397),.045,3.32,.025,edge);
        }
        box(0,7.72,side*(halfD+.40),3.84,.26,.36,enamel);
        box(0,7.82,side*(halfD+.49),3.91,.06,.23,edge);
        box(0,4.49,side*(halfD+.31),3.84,.12,.22,soot);
      }
    }
    // Raised north-light monitor: opaque glass and metal panels keep the pass count fixed.
    const roofSpan=b.w*(index%3===0?.57:.44),z0=index%2?1.35:-1.35;
    const rise=b.upper?.95:.77,depth=2.9,tilt=Math.atan2(rise,depth);
    box(0,cap+.14,z0,roofSpan+.23,.28,depth+.22,soot);
    const midY=cap+.33+rise*.5;
    box(0,midY,z0,roofSpan+.18,.13,Math.hypot(depth,rise)+.16,enamel,tilt);
    box(0,midY,z0-depth/2,roofSpan,rise,.10,glass);
    box(0,cap+.32,z0-depth/2,roofSpan+.18,.13,.16,edge);
    box(0,cap+.34+rise,z0-depth/2,roofSpan+.25,.13,.19,edge);
    const diagonals=new T.BufferGeometry();
    // Triplets retain the full triangular end profile under the sloped roof.
    const vertices:number[]=[];
    for(const side of [-1,1]){
      const x=side*roofSpan/2;
      const corners=[[x,cap+.30,z0-depth/2],[x,cap+.30,z0+depth/2],[x,cap+.33+rise,z0-depth/2]];
      for(const i of side===1?[0,2,1]:[0,1,2])vertices.push(...corners[i]);
    }
    diagonals.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    diagonals.setIndex([0,1,2,3,4,5]);diagonals.computeVertexNormals();
    diagonals.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(12),2));
    piece(diagonals,0,0,0,sheet);
    const panes=Math.ceil(roofSpan/1.25);
    for(let j=0;j<=panes;j++){
      const x=-roofSpan/2+j*roofSpan/panes;
      box(x,midY,z0-depth/2-.06,.065,rise+.06,.09,soot);
      box(x,midY+.085,z0,.055,.055,Math.hypot(depth,rise)+.10,edge,tilt);
    }
    // Exhaust cowls and duct flashing set the service side apart from the glazing.
    for(let j=0;j<(b.upper?2:1);j++){
      const x=-halfW+2.0+j*1.15,z=halfD-2.2;
      box(x,cap+.06,z,.85,.12,.85,soot);
      pipe(x,cap+.56,z,.22,.26,1.0,sheet);
      pipe(x,cap+1.03,z,.20,.22,.12,soot);
      pipe(x,cap+1.17,z,.085,.39,.18,edge);
    }
    const geometry=mergeGeometries(pieces);
    pieces.forEach(g=>g.dispose());
    if(!geometry)continue;
    geometry.computeBoundingSphere();
    const detail=new T.Mesh(geometry,loadingBay?shutterMaterial:material);detail.receiveShadow=true;detail.matrixAutoUpdate=false;
    detail.position.set(b.x,0,b.z);detail.updateMatrix();group.add(detail);
  }
  return group;
}
