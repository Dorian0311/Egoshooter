import * as T from 'three';
import {islandShops} from '../shared/islandStreet';

const diner=islandShops[0];
const x=diner.x+diner.w/2+.12,z=diner.z+2.2;
const notices=[
  'Ihr Antrag auf Weiterleben ist eingegangen. Die Bearbeitungszeit übersteigt Ihre Restlaufzeit.',
  'Für Ihre Sterbeurkunde fehlt eine Unterschrift. Bitte erscheinen Sie nach Ihrem Ableben persönlich.',
  'Ihre Beschwerde wurde an die Hinterbliebenen weitergeleitet. Ihre Familie erfährt es mit der nächsten Gebührenrechnung.',
  'Die Beerdigung geht aufs Haus. Das Haus geht dafür an die Gemeinde.',
];

export function createHarbourClaims(scene:T.Scene){
  const kiosk=new T.Group();
  kiosk.name='Hafenamt · Nachlassschalter';
  kiosk.position.set(x,1.42,z);kiosk.rotation.y=Math.PI/2;scene.add(kiosk);
  const enamel=new T.MeshStandardMaterial({color:'#395f59',metalness:.35,roughness:.56});
  const brass=new T.MeshStandardMaterial({color:'#c2a071',metalness:.64,roughness:.45});
  function box(w:number,h:number,d:number,y:number,front:number,m:T.Material){
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);
    mesh.position.set(0,y,front);mesh.receiveShadow=true;kiosk.add(mesh);
  }
  box(.77,1.08,.20,0,0,enamel);
  box(.83,.055,.30,.56,.015,brass);
  box(.55,.06,.21,-.39,.10,brass);
  const sheet=document.createElement('canvas');sheet.width=384;sheet.height=448;
  const ink=sheet.getContext('2d')!;
  const texture=new T.CanvasTexture(sheet);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  const face=new T.Mesh(new T.PlaneGeometry(.66,.78),new T.MeshStandardMaterial({map:texture,roughness:.84}));
  face.position.set(0,.07,.104);kiosk.add(face);
  let issued=0,last=-Infinity;
  function print(){
    ink.fillStyle='#ddd2aa';ink.fillRect(0,0,384,448);
    ink.strokeStyle='#323d32';ink.lineWidth=4;ink.strokeRect(10,10,364,428);
    ink.textAlign='center';ink.fillStyle='#34483e';ink.font='bold 25px Georgia';ink.fillText('HAFENAMT · INSELBEZIRK',192,62);
    ink.font='bold 43px Georgia';ink.fillText('Nachlassschalter',192,128);
    ink.fillStyle='#40463d';ink.font='20px Georgia';ink.fillText('Auch ohne Termin sterblich.',192,169);
    ink.fillRect(32,196,320,3);ink.font='bold 19px monospace';ink.fillText('IHR AKTENZEICHEN',192,242);
    ink.font='bold 68px monospace';ink.fillText('N–'+String(issued).padStart(3,'0'),192,329);
    ink.font='20px Georgia';ink.fillText('Bitte einzeln vortreten.',192,402);texture.needsUpdate=true;
  }
  print();
  const target={id:'harbour-claims',label:'Nachlass regeln'};
  return {
    interaction(p:{x:number;y:number;z:number},yaw:number){
      const dx=p.x-x,dz=p.z-z,d=dx*dx+dz*dz;
      return dx>.05&&d<4.8&&Math.abs(p.y)<1.25&&dx*Math.sin(yaw)+dz*Math.cos(yaw)>.68*Math.sqrt(d)?target:undefined;
    },
    use(now:number){
      if(now-last<500)return;
      issued++;last=now;print();
    },
    label(now:number){
      return issued&&now-last<8000?'Hafenamt · Bescheid '+issued+' — '+notices[(issued-1)%notices.length]:'';
    },
    dispose(){
      kiosk.removeFromParent();kiosk.traverse(child=>{if(child instanceof T.Mesh)child.geometry.dispose();});
      face.material.dispose();texture.dispose();brass.dispose();enamel.dispose();
    },
  };
}
