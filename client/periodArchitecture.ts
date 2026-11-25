import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {World} from '../shared/world';

/** Architectural trim for the pre-war masonry, goods depots and mountain barracks. */
export function createPeriodArchitecture(world:World){
  const group=new T.Group();group.name='Period masonry and railway architecture';
  if(world.id==='storm')return group;
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:.06});
  const matrix=new T.Matrix4(),quaternion=new T.Quaternion(),angles=new T.Euler();
  const translation=new T.Vector3(),scale=new T.Vector3(1,1,1),tint=new T.Color();
  for(const [number,b] of world.buildings.entries()){
    const broad:T.BufferGeometry[]=[],close:T.BufferGeometry[]=[];
    let timetable:T.Mesh|undefined;
    const upper=b.upper?8:4,wallX=b.w/2,wallZ=b.d/2,gableZ=wallZ+.52;
    const alpine=world.id==='alpine',cinema=b.name==='UNION-LICHTSPIELE';
    const station=/BAHNHOF|KÖLN-DEUTZ/.test(b.name);
    const deutz=world.id==='cologne'&&b.name==='DEUTZER BAHNHOF';
    const shed=/HALLE|WERKSHOF|DEPOT/.test(b.name)&&!alpine;
    const stone=['#a79d86','#ae9f85','#aba393'][number%3],shadow='#766e60';
    const brick=number%2?'#905e4c':'#985e48',iron='#454a42',timber='#665742';
    function add(g:T.BufferGeometry,x:number,y:number,z:number,color:string,rx=0,rz=0,near=false){
      quaternion.setFromEuler(angles.set(rx,0,rz));
      g.applyMatrix4(matrix.compose(translation.set(x,y,z),quaternion,scale));
      const p=g.getAttribute('position'),n=g.getAttribute('normal'),rgb=new Float32Array(p.count*3);
      tint.set(color);
      for(let i=0;i<p.count;i++){
        const wear=.90+.045*Math.sin(p.getX(i)*2.21+p.getY(i)*.87+p.getZ(i)*1.79)+.055*n.getY(i);
        rgb[i*3]=tint.r*wear;rgb[i*3+1]=tint.g*wear;rgb[i*3+2]=tint.b*wear;
      }
      g.setAttribute('color',new T.BufferAttribute(rgb,3));(near?close:broad).push(g);
    }
    function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx=0,rz=0,near=false){
      add(new T.BoxGeometry(w,h,d),x,y,z,c,rx,rz,near);
    }
    for(const side of [-1,1]){
      const face=side*gableZ;
      // The pitched roof is already part of the map. Bargeboards follow its actual 2.4 m rise.
      const run=wallX+.52,angle=Math.atan2(2.4,run);
      for(const wing of [-1,1]){
        box(wing*run/2,upper+1.51,face,Math.hypot(run,2.4)+.10,.16,.18,
          alpine?timber:shed?brick:stone,0,-wing*angle);
      }
      if(alpine){
        // A louvred attic vent bordered by heavy timber and deep projecting purlin ends.
        box(0,upper+1.25,face,2.3,1.12,.085,'#49473d');
        for(const x of [-1.19,1.19])box(x,upper+1.25,face+side*.055,.11,1.35,.14,timber);
        for(let slat=0;slat<5;slat++)box(0,upper+.83+slat*.205,face+side*.06,2.23,.13,.12,timber,-side*.28,0,true);
        for(const x of [-6.0,-3.0,0,3.0,6.0]){
          const y=upper+2.49-2.4*Math.abs(x)/run;
          box(x,y,face+side*.13,.19,.20,.50,timber);
        }
      }else if(station){
        // Enamel station dial over the doorway, with raised iron hands and hour strokes.
        const cy=upper+1.36,r=.84;
        add(new T.CylinderGeometry(r,r,.18,32),0,cy,face+side*.12,iron,Math.PI/2);
        add(new T.CylinderGeometry(r-.085,r-.085,.05,32),0,cy,face+side*.23,'#dfd5b8',Math.PI/2);
        for(let h=0;h<12;h++){
          const a=h*Math.PI/6;
          box(Math.sin(a)*.64,cy+Math.cos(a)*.64,face+side*.27,.045,h%3===0?.16:.10,.018,iron,0,-a,true);
        }
        const hands=[[Math.PI*.93,.36],[-Math.PI*.35,.56]];
        for(const [a,length] of hands)
          box(side*Math.sin(a)*length/2,cy+Math.cos(a)*length/2,face+side*.29,.055,length,.025,iron,0,-side*a);
        // Shallow wrought-iron canopy over the station entrance, with a fretwork valance.
        if(deutz&&side===1){
          // A shallow iron-and-wired-glass marquise over the main station frontage.
          // Its brackets cantilever from the masonry; the entire approach stays open.
          const green='#40534d',glazing=['#a2afa5','#aeb7ac','#94a399'];
          const width=13.4,bays=8,panel=width/bays;
          for(let i=0;i<bays;i++){
            const x=(i+.5)*panel-width/2;
            box(x,4.10,wallZ+1.79,panel-.045,.052,2.59,glazing[i%3],.085);
          }
          for(let i=0;i<=bays;i++){
            const x=i*panel-width/2;
            box(x,4.08,wallZ+1.79,.068,.12,2.73,green,.085);
            if(i%2===0&&Math.abs(x)>2){
              box(x,3.67,wallZ+.47,.12,.91,.17,green);
              box(x,3.60,wallZ+1.44,.093,.10,2.23,green,-.35);
              box(x,3.84,wallZ+1.45,.07,.38,.075,green,0,0,true);
            }
          }
          box(0,3.97,wallZ+3.14,width+.16,.19,.14,green);
          box(0,4.04,wallZ+3.18,width+.26,.06,.17,'#879185');
          for(const x of [-7.65,7.65]){
            const lampZ=wallZ+1.47;
            box(x,3.12,wallZ+.40,.21,.46,.14,green);
            box(x,3.26,wallZ+.94,.080,.11,1.12,green);
            box(x,3.06,wallZ+.82,.065,.065,.93,green,-.37);
            add(new T.CylinderGeometry(.06,.30,.16,6),x,3.15,lampZ,green);
            add(new T.CylinderGeometry(.265,.18,.42,6),x,2.87,lampZ,'#d9ccb1');
            add(new T.CylinderGeometry(.19,.09,.075,6),x,2.62,lampZ,green);
          }
          // Louvered attic openings flank the dial under its pitched stone pediment.
          for(const x of [-3.35,3.35]){
            box(x,upper+.84,face+.04,2.35,.69,.11,stone);
            box(x,upper+.84,face+.12,2.12,.54,.08,'#4c5650');
            for(let j=0;j<3;j++)box(x,upper+.66+j*.17,face+.19,2.08,.075,.09,green,-.25);
          }
          const boardX=-3.93,boardZ=wallZ+.57;
          box(boardX,1.97,boardZ,2.38,1.84,.14,green);
          box(boardX,2.94,boardZ+.055,2.49,.10,.24,iron);
          box(boardX,1.02,boardZ+.06,2.48,.11,.24,stone);
          const paper=new T.TextureLoader().load('/shooter/environment/deutz-abfahrt.webp');
          paper.colorSpace=T.SRGBColorSpace;paper.anisotropy=4;
          timetable=new T.Mesh(new T.PlaneGeometry(2.24,1.68),new T.MeshStandardMaterial({map:paper,roughness:.91}));
          timetable.name='Deutzer Bahnhof – Abfahrtstafel';
          timetable.position.set(boardX,1.97,boardZ+.075);
          // Broad, flush joints define the forecourt pavement against the surrounding setts.
          for(const dx of [-1,1]){
            box(dx*6.45,.020,wallZ+3.18,.19,.04,5.78,'#a39984');
            box(dx*4.16,.021,wallZ+6.02,4.74,.04,.18,'#aa9f88');
            const grateX=dx*5.80,grateZ=wallZ+5.68;
            box(grateX,.021,grateZ,.75,.043,.37,'#4a4c43',0,0,true);
            for(let j=0;j<7;j++)box(grateX-.29+j*.097,.05,grateZ,.031,.021,.31,'#767568',0,0,true);
            for(let j=0;j<4;j++)box(dx*(1.91+j*1.14),.017,wallZ+3.36,.035,.031,5.05,'#887f70',0,0,true);
          }
        }else if(world.id!=='frontline'||side<0){
          const canopyZ=side*(wallZ+1.17);
          box(0,3.90,canopyZ,6.25,.12,1.88,'#637166',side*.065);
          box(0,3.78,canopyZ+side*.94,6.30,.23,.09,iron);
          for(const x of [-2.66,2.66]){
            box(x,3.46,canopyZ,.085,.09,1.93,iron,-side*.39);
            for(const xoff of [-.15,.15])
              box(x+xoff,3.70,canopyZ,.038,.04,1.45,iron,side*.20,0,true);
          }
        }
      }else if(shed){
        // Brick pilasters and a soldier-course frieze on the freight and machine halls.
        for(const x of [-wallX+.35,wallX-.35]){
          box(x,upper/2,side*(wallZ+.37),.58,upper,.36,brick);
          box(x,.30,side*(wallZ+.43),.72,.59,.42,shadow);
          box(x,upper-.19,side*(wallZ+.43),.78,.28,.43,brick);
        }
        box(0,upper+.23,face,b.w+.18,.20,.15,brick);
        for(let x=-wallX+.38;x<wallX;x+=.58)
          box(x,upper+.05,face,.26,.24,.21,brick,0,0,true);
        for(let j=0;j<6;j++)box(0,upper+.73+.16*j,face+.07*side,2.35,.083,.10,iron,side*.15,0,true);
      }else if(!cinema){
        // Limewashed townhouse gables have a small oculus, a cut stone belt and rusticated corners.
        add(new T.CylinderGeometry(.62,.62,.13,24),0,upper+1.30,face+.07*side,stone,Math.PI/2);
        add(new T.CylinderGeometry(.45,.45,.05,24),0,upper+1.30,face+.16*side,'#525953',Math.PI/2);
        box(0,upper+1.3,face+.20*side,.048,.90,.02,timber,0,0,true);
        box(0,upper+1.3,face+.20*side,.89,.048,.02,timber,0,0,true);
        box(0,upper+.26,face,b.w+.24,.16,.19,stone);
      }
      // These sills stop at the existing jambs and leave the side access at z=0 open.
      const sideFace=side*(wallX+.26);
      for(let level=1;level<(b.upper?2:1);level++)for(const bay of [-1,1]){
        const y=4*level,z=3.25*bay;
        box(sideFace,y+1.13,z,.38,.18,3.52,alpine?shadow:stone);
        box(sideFace,y+2.58,z,.23,.17,3.76,alpine?timber:shed?brick:stone);
        if(!alpine&&!shed)for(const end of [-1,1])
          box(sideFace,y+1.87,z+end*1.77,.16,1.33,.16,stone,0,0,true);
      }
    }
    const lod=new T.LOD();lod.position.set(b.x,0,b.z);
    for(const [details,distance] of [[true,0],[false,54]] as const){
      const geometry=mergeGeometries(details?[...broad,...close]:broad);
      if(!geometry)continue;
      geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;
      if(details&&timetable)mesh.add(timetable);
      lod.addLevel(mesh,distance,.10);
    }
    for(const geometry of [...broad,...close])geometry.dispose();
    group.add(lod);
  }
  return group;
}
