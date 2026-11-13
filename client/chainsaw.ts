import * as T from 'three';
/** Lightweight first-person tool with an animated chain; no external asset needed. */
export function createChainsaw(){
 const group=new T.Group(),teeth:T.Mesh[]=[];group.scale.setScalar(.78);
 const steel=new T.MeshStandardMaterial({color:0x9daba8,metalness:.8,roughness:.35});
 const casing=new T.MeshStandardMaterial({color:0xd2a52f,metalness:.3,roughness:.65});
 const rubber=new T.MeshStandardMaterial({color:0x232727,roughness:.9});
 const skin=new T.MeshStandardMaterial({color:0xb4977b,roughness:.85});
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);group.add(mesh);return mesh;}
 const shell=new T.Shape();shell.moveTo(-.1,-.09);shell.lineTo(.1,-.09);shell.lineTo(.1,.09);shell.lineTo(-.1,.09);shell.closePath();
 const motor=new T.Mesh(new T.ExtrudeGeometry(shell,{depth:.28,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:3,steps:1}),casing);motor.position.z=-.14;group.add(motor);
 const bladeShape=new T.Shape();bladeShape.moveTo(0,-.075);bladeShape.lineTo(.59,-.075);bladeShape.absarc(.59,0,.075,-Math.PI/2,Math.PI/2,false);bladeShape.lineTo(0,.075);bladeShape.closePath();
 const blade=new T.Mesh(new T.ExtrudeGeometry(bladeShape,{depth:.032,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:2,steps:1}),steel);blade.rotation.y=Math.PI/2;blade.position.set(-.016,0,-.18);group.add(blade);
 box(0,-.01,.24,.19,.08,.2,rubber);box(-.16,.1,-.1,.04,.04,.25,rubber);box(-.08,.2,-.12,.2,.04,.04,rubber);box(-.17,.15,-.12,.04,.13,.04,rubber);
 for(let n=0;n<24;n++)teeth.push(box(0,0,0,.075,.035,.035,steel));
 function hand(x:number,y:number,z:number){const palm=new T.Mesh(new T.CapsuleGeometry(.045,.055,4,8),skin);palm.position.set(x,y,z);palm.rotation.x=Math.PI/2;group.add(palm);for(let n=0;n<4;n++){const finger=new T.Mesh(new T.CapsuleGeometry(.012,.055,3,6),skin);finger.position.set(x-.03+n*.02,y-.025,z-.03);finger.rotation.x=-.6;group.add(finger);}}
 hand(.04,-.04,.25);hand(-.17,.11,-.09);
 for(let n=0;n<5;n++)box(.122,.025-n*.025,.02,.008,.012,.17,rubber);
 return {group,update(time:number,attacking:boolean){
  const phase=time*(attacking?.004:.0003);
  for(let n=0;n<teeth.length;n++){const angle=n/teeth.length*Math.PI*2+phase;teeth[n].position.set(0,Math.sin(angle)*.098,-.51+Math.cos(angle)*.36);teeth[n].rotation.x=-angle;}
  group.position.set(.27+(attacking?Math.sin(time*.09)*.004:0),-.25+(attacking?Math.cos(time*.07)*.004:0),-.7);group.rotation.set(attacking?-.08:0,.55,-.12);
 },dispose(){group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});steel.dispose();casing.dispose();rubber.dispose();skin.dispose();}};
}
