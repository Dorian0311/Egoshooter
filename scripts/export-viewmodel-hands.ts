// Anatomical MIT muster hands, generated offline; no SDF work runs in the browser.
import {gripHand} from '../research/muster-src/src/assets/shared/human/hands.ts';
import {Group,MeshStandardMaterial,Vector3,Mesh,CylinderGeometry} from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {writeFile} from 'node:fs/promises';
(globalThis as any).FileReader=class {result:unknown;onloadend?:()=>void;async readAsArrayBuffer(b:Blob){this.result=await b.arrayBuffer();this.onloadend?.();}async readAsDataURL(b:Blob){this.result='data:application/octet-stream;base64,'+Buffer.from(await b.arrayBuffer()).toString('base64');this.onloadend?.();}};
const root=new Group();root.name='g36-view-hands';
for(const side of ['r','l'] as const){
 const grip=side==='r'?{position:new Vector3(0,-.025,.075),axis:new Vector3(0,1,-.25).normalize(),palm:new Vector3(-1,0,-.3).normalize(),radius:.019}:
 {position:new Vector3(0,.055,.40),axis:new Vector3(0,0,1),palm:new Vector3(.3,-1,0).normalize(),radius:.029};
 const direction=new Vector3(side==='r'?-.2:.3,-.5,-1).normalize();
 const skin=new MeshStandardMaterial({color:0xb29680,roughness:.78});
 const hand=gripHand(grip,side,skin,{forearm:direction,index:side==='r'?'trigger':'wrap'});
 hand.mesh.name='hand-'+side;root.add(hand.mesh);
 const geometry=new CylinderGeometry(.036,.075,.48,16,12);
 const positions=geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++){
  const y=positions.getY(i),fold=1+.045*Math.sin(y*95)+.025*Math.sin(y*173);
  positions.setXYZ(i,positions.getX(i)*fold,y,positions.getZ(i)*fold*.9);
 }
 geometry.computeVertexNormals();
 const sleeve=new Mesh(geometry,new MeshStandardMaterial({color:0x42473a,roughness:.95}));
 sleeve.quaternion.setFromUnitVectors(new Vector3(0,-1,0),direction);
 sleeve.position.copy(hand.frame.o).addScaledVector(direction,.25);sleeve.name='view-sleeve-'+side;root.add(sleeve);
}
const binary=await new GLTFExporter().parseAsync(root,{binary:true});
await writeFile('public/shooter/models/viewmodel-hands.glb',Buffer.from(binary as ArrayBuffer));
console.log('G36 anatomical hands exported:',(binary as ArrayBuffer).byteLength,'bytes');
