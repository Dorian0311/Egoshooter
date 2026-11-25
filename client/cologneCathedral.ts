import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {projectBoxUVs} from './materials';

/** Original skyline model based on the cathedral's paired Gothic spires. */
export function createCologneCathedral(masonry:T.Texture){
  const pieces:T.BufferGeometry[]=[];
  const stone='#746f62',trim='#94897a',shadow='#554e47',slate='#414b49',glass='#333b3b';
  const colour=new T.Color();
  function add(geometry:T.BufferGeometry,x:number,y:number,z:number,colourHex:string){
    geometry.translate(x,y,z);
    projectBoxUVs(geometry,new T.Vector3(),4);
    const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
    const colors=new Float32Array(position.count*3);
    colour.set(colourHex);
    for(let index=0;index<position.count;index++){
      const shade=.93+.035*normal.getY(index)+.035*Math.sin(position.getY(index)*.87+position.getZ(index)*.73);
      colors[index*3]=colour.r*shade;
      colors[index*3+1]=colour.g*shade;
      colors[index*3+2]=colour.b*shade;
    }
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    if(geometry.index){
      const flat=geometry.toNonIndexed();
      geometry.dispose();
      geometry=flat;
    }
    pieces.push(geometry);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,colourHex:string){
    add(new T.BoxGeometry(w,h,d),x,y,z,colourHex);
  }
  function spire(x:number,y:number,z:number,bottom:number,top:number,height:number,colourHex:string){
    add(new T.CylinderGeometry(top,bottom,height,8,1,false),x,y,z,colourHex);
  }
  function pointedPanel(x:number,y:number,z:number,width:number,height:number,colourHex:string){
    const half=width/2,shoulder=height*.58;
    const outline=new T.Shape();
    outline.moveTo(-half,0);
    outline.lineTo(half,0);
    outline.lineTo(half,shoulder);
    outline.quadraticCurveTo(half*.85,height*.81,0,height);
    outline.quadraticCurveTo(-half*.85,height*.81,-half,shoulder);
    outline.closePath();
    add(new T.ShapeGeometry(outline,4).rotateY(Math.PI/2),x,y,z,colourHex);
  }
  box(-88,6.65,-45,24.8,13.3,22.8,stone);
  box(-89,8.9,-45,22,17.8,12.2,stone);
  const roof=new T.CylinderGeometry(1,1,22,3,1,false,Math.PI/2);
  roof.rotateZ(Math.PI/2).scale(1,6.4,7.5);
  add(roof,-89,20.4,-45,slate);
  for(const side of [-1,1]){
    const z=-45+side*9.7;
    for(const x of [-98,-93,-88,-83,-78]){
      box(x,5.3,z,1.45,10.6,4.5,stone);
      box(x,10.7,z+side*1.4,1.66,.55,2.18,trim);
      spire(x,12.28,z+side*1.4,1,.09,2.95,shadow);
    }
  }
  box(-78.1,11.1,-45,6.7,22.1,11.9,stone);
  pointedPanel(-74.70,9.2,-45,7,12.25,trim);
  pointedPanel(-74.65,9.62,-45,6.2,11.07,glass);
  const rose=new T.RingGeometry(2.06,2.32,16).rotateY(Math.PI/2);
  add(rose,-74.60,15.61,-45,trim);
  for(let spoke=0;spoke<8;spoke++){
    const geometry=new T.BoxGeometry(.10,4.3,.13).rotateX(spoke*Math.PI/8);
    add(geometry,-74.60,15.61,-45,trim);
  }
  for(const z of [-53,-37]){
    box(-78,16.8,z,5.9,33.6,6.2,stone);
    for(const y of [4.55,12.3,21.1,30.15,33.35])
      box(-78,y,z,6.17,.42,6.46,trim);
    for(const dz of [-2.58,2.58]){
      box(-74.97,15.98,z+dz,.62,31.96,.72,trim);
      spire(-75.46,34.95,z+dz,.57,.04,3.25,shadow);
      spire(-80.54,34.95,z+dz,.57,.04,3.25,shadow);
    }
    for(const y of [5.15,13.0,22.0]){
      pointedPanel(-74.99,y,z,3.52,6.7,trim);
      pointedPanel(-74.95,y+.32,z,2.90,5.98,glass);
      for(const dz of [-.64,.64])box(-74.90,y+2.38,z+dz,.10,4.14,.14,trim);
    }
    spire(-78,35.8,z,3.48,2.32,5.4,shadow);
    spire(-78,42.05,z,2.35,1.03,7.1,slate);
    spire(-78,49.02,z,1.03,.09,6.9,slate);
    spire(-78,53,z,.28,.09,1.4,trim);
    for(const y of [37.25,40.11,43.9,47.6]){
      const radius=3.05-(y-37)*.178;
      spire(-78,y,z,radius+.09,radius-.005,.37,trim);
    }
  }
  const geometry=mergeGeometries(pieces)!;
  pieces.forEach(piece=>piece.dispose());
  geometry.computeBoundingSphere();
  const material=new T.MeshStandardMaterial({map:masonry,vertexColors:true,roughness:.92});
  material.onBeforeCompile=shader=>{
    // Keep the vertex colours for the recessed windows and roof. Masonry only
    // modulates their luminance, so the roof retains its slate hue.
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 masonry=texture2D(map,vMapUv).rgb;
      diffuseColor.rgb*=.67+dot(masonry,vec3(.2126,.7152,.0722))*.98;
    `);
  };
  const mesh=new T.Mesh(geometry,material);
  mesh.name='Cologne cathedral skyline';
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  mesh.matrixAutoUpdate=false;
  return mesh;
}
