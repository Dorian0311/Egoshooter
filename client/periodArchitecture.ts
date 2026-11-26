import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {World} from '../shared/world';

type NightFixtures={intensity:{value:number};pools:T.Mesh[];papers:T.MeshStandardMaterial[]};
const fixtures=new WeakMap<T.Group,NightFixtures>();

export function setPeriodNight(group:T.Group,enabled:boolean){
  const state=fixtures.get(group);if(!state)return;
  state.intensity.value=enabled?1:0;
  for(const mesh of state.pools)mesh.visible=enabled;
  for(const paper of state.papers)paper.emissiveIntensity=enabled?.22:0;
}

/** Architectural trim for the pre-war masonry, goods depots and mountain barracks. */
export function createPeriodArchitecture(world:World){
  const group=new T.Group();group.name='Period masonry and railway architecture';
  if(world.id==='storm')return group;
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:.06});
  const night:NightFixtures={intensity:{value:0},pools:[],papers:[]};
  fixtures.set(group,night);
  const matrix=new T.Matrix4(),quaternion=new T.Quaternion(),angles=new T.Euler();
  const translation=new T.Vector3(),scale=new T.Vector3(1,1,1),tint=new T.Color();
  for(const [number,b] of world.buildings.entries()){
    const broad:T.BufferGeometry[]=[],close:T.BufferGeometry[]=[];
    let timetable:T.Mesh|undefined;
    const upper=b.upper?8:4,wallX=b.w/2,wallZ=b.d/2,gableZ=wallZ+.52;
    const alpine=world.id==='alpine',cinema=b.name==='UNION-LICHTSPIELE';
    const fortress=alpine&&b.name==='ROCHE-LA-CROIX';
    const domhof=world.id==='cologne'&&b.name==='AM DOMHOF';
    const station=/BAHNHOF|KÖLN-DEUTZ/.test(b.name);
    const deutz=world.id==='cologne'&&b.name==='DEUTZER BAHNHOF';
    const illuminated=deutz||cinema;
    const trim=illuminated||fortress||domhof?material.clone():material;
    if(fortress||domhof){
      trim.map=new T.TextureLoader().load('/shooter/environment/'+(fortress?'alpine-fort-casement':'domhof-bookshop')+'.webp');
      trim.map.colorSpace=T.SRGBColorSpace;trim.map.anisotropy=4;
    }
    if(illuminated)trim.onBeforeCompile=shader=>{
      shader.uniforms.periodNight=night.intensity;
      shader.vertexShader='attribute float lampGlass; varying float vLampGlass;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLampGlass=lampGlass;');
      shader.fragmentShader='varying float vLampGlass; uniform float periodNight;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=periodNight*vLampGlass*vec3(1.0,.68,.35);');
    };
    const shed=/HALLE|WERKSHOF|DEPOT/.test(b.name)&&!alpine;
    const stone=['#a79d86','#ae9f85','#aba393'][number%3],shadow='#766e60';
    const brick=number%2?'#905e4c':'#985e48',iron='#454a42',timber='#665742';
    function add(g:T.BufferGeometry,x:number,y:number,z:number,color:string,rx=0,rz=0,near=false,glow=0){
      quaternion.setFromEuler(angles.set(rx,0,rz));
      g.applyMatrix4(matrix.compose(translation.set(x,y,z),quaternion,scale));
      const p=g.getAttribute('position'),n=g.getAttribute('normal'),rgb=new Float32Array(p.count*3);
      if(fortress||domhof){
        // All unprinted trim shares the atlas's white margin and retains its vertex paint.
        const uv=g.getAttribute('uv');
        for(let i=0;i<uv.count;i++)uv.setXY(i,1020/1024,.5);
      }
      tint.set(color);
      for(let i=0;i<p.count;i++){
        const wear=.90+.045*Math.sin(p.getX(i)*2.21+p.getY(i)*.87+p.getZ(i)*1.79)+.055*n.getY(i);
        rgb[i*3]=tint.r*wear;rgb[i*3+1]=tint.g*wear;rgb[i*3+2]=tint.b*wear;
      }
      if(illuminated)g.setAttribute('lampGlass',new T.BufferAttribute(new Float32Array(p.count).fill(glow),1));
      g.setAttribute('color',new T.BufferAttribute(rgb,3));(near?close:broad).push(g);
    }
    function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx=0,rz=0,near=false){
      add(new T.BoxGeometry(w,h,d),x,y,z,c,rx,rz,near);
    }
    if(domhof){
      // The street elevation stands against the solid upper wall. On the river
      // elevation every skin panel follows the masonry around the playable windows.
      function elevation(river:boolean,left:number,right:number,bottom:number,top:number){
        const skin=new T.PlaneGeometry(right-left,top-bottom);
        if(river)skin.rotateY(Math.PI/2);
        const mid=(left+right)/2,half=river?wallZ:wallX;
        add(skin,river?wallX+.239:mid,(bottom+top)/2,river?-mid:wallZ+.424,'#fffdf4');
        const uv=skin.getAttribute('uv'),pos=skin.getAttribute('position');
        for(let i=0;i<uv.count;i++){
          const along=river?-pos.getZ(i):pos.getX(i),u=(along+half)/(2*half);
          const v=(8-pos.getY(i))/4;
          uv.setXY(i,(3.5+u*1007)/1024,1-((river?258.5:3.5)+v*247)/816);
        }
      }
      elevation(false,-wallX,wallX,4.01,8);
      for(const [bottom,top] of [[4.01,5.2],[6.5,8]])elevation(true,-wallZ,wallZ,bottom,top);
      for(const [left,right] of [[-wallZ,-5],[-1.5,1.5],[5,wallZ]])elevation(true,left,right,5.2,6.5);
      // Two display cases sit on the solid ground-floor wings. Illustrated book
      // covers and a leaded transom sit behind the projecting shop joinery.
      for(const wing of [-1,1]){
        const cx=wing*5.50,face=wallZ+.434,joinery='#374d43';
        const art=new T.PlaneGeometry(6.18,2.89);
        add(art,cx,1.89,face,'#fff9eb');
        const uv=art.getAttribute('uv'),pos=art.getAttribute('position'),tile=wing<0?4:510;
        for(let i=0;i<uv.count;i++){
          const u=(pos.getX(i)-cx)/6.18+.5,v=(1.89-pos.getY(i))/2.89+.5;
          uv.setXY(i,(tile+1+u*497)/1024,1-(519+v*289)/816);
        }
        for(const edge of [-1,1]){
          box(cx+edge*3.10,1.89,face+.053,.15,2.97,.18,joinery);
          box(cx+edge*3.10,1.89,face+.153,.055,2.83,.033,'#8d7957',0,0,true);
        }
        box(cx,3.38,face+.07,6.40,.13,.29,joinery);
        box(cx,3.48,face+.06,6.50,.073,.34,'#968869');
        box(cx,.49,face+.08,6.37,.14,.31,'#837863');
        box(cx,2.89,face+.053,6.15,.055,.096,joinery);
        for(const pane of [-1,1])box(cx+pane*1.02,1.995,face+.045,.052,1.73,.084,joinery);
      }
      for(const x of [-6.43,-2.70,2.70,6.43]){
        box(x,4.88,wallZ+.51,2.34,.12,.32,'#a5967d');
        if(Math.abs(x)>3)continue;
        // The flower balconies project over the central windows facing the street.
        box(x,4.94,wallZ+.74,2.23,.11,.69,'#928972');
        for(const y of [5.07,5.49])box(x,y,wallZ+1.04,2.20,.055,.06,iron);
        for(const side of [-1,1])box(x+side*1.07,5.49,wallZ+.76,.054,.06,.54,iron);
        for(let i=-4;i<=4;i++)box(x+i*.248,5.27,wallZ+1.04,.030,.45,.035,iron,0,0,true);
        for(const offset of [-.66,0,.66])
          add(new T.TorusGeometry(.16,.017,4,12),x+offset,5.28,wallZ+1.06,'#536255',0,0,true);
      }
    }
    if(fortress){
      const concrete='#a4a497',aggregate='#797d72',armour='#535e55';
      // The two flared concrete cheeks stand against solid masonry. Their battered faces
      // recede with height; the existing central doorway and its nameplate remain exposed.
      for(const wing of [-1,1]){
        const points:[number,number][]=[[2.26,.04],[8.98,.04],[8.98,2.49],[8.41,2.93],[3.05,2.93],[2.26,2.45]];
        const pos:number[]=[],uv:number[]=[],index:number[]=[];
        const vertex=(n:number,forward:boolean):[number,number,number]=>{
          const [x,y]=points[n];
          return [wing*x,y,wallZ+(forward?.83-.081*y:.15)];
        };
        function face(vertices:[number,number,number][]){
          if(wing<0)vertices.reverse();
          const base=pos.length/3;
          for(const v of vertices){pos.push(...v);uv.push(v[0]*.25,v[1]*.25);}
          for(let j=1;j<vertices.length-1;j++)index.push(base,base+j,base+j+1);
        }
        face(points.map((_,i)=>vertex(i,true)));
        face(points.map((_,i)=>vertex(points.length-1-i,false)));
        for(let i=0;i<points.length;i++){
          const next=(i+1)%points.length;
          face([vertex(i,false),vertex(next,false),vertex(next,true),vertex(i,true)]);
        }
        const cheek=new T.BufferGeometry();cheek.setAttribute('position',new T.Float32BufferAttribute(pos,3));
        cheek.setAttribute('uv',new T.Float32BufferAttribute(uv,2));cheek.setIndex(index);cheek.computeVertexNormals();
        add(cheek,0,0,0,concrete);
        // The six front vertices belong exclusively to the battered face. Fit the formwork
        // to the wall instead of mirroring its stencil or projecting it over the chamfers.
        const cheekUv=cheek.getAttribute('uv'),cheekTint=cheek.getAttribute('color');
        const firstPixel=wing<0?4:510,minX=wing<0?-8.98:2.26;
        for(let i=0;i<points.length;i++){
          const u=(pos[i*3]-minX)/6.72,v=(pos[i*3+1]-.04)/2.89;
          cheekUv.setXY(i,(firstPixel+2+u*497)/1024,1-(254-v*251)/672);
          cheekTint.setXYZ(i,.92,.92,.92);
        }
        for(const y of [.55,1.38,2.17]){
          const z=wallZ+.84-.081*y;
          box(wing*5.63,y,z,6.61,.027,.027,aggregate,0,0,true);
          for(const dx of [3.13,5.67,8.27])add(new T.CylinderGeometry(.047,.047,.022,8),wing*dx,y+.15,z-.005,aggregate,Math.PI/2,0,true);
        }
        // Recessed louvres on the non-opening wall bay, protected by a projecting brow.
        const ventX=wing*5.56;
        box(ventX,1.88,wallZ+.73,2.20,.51,.17,armour);
        for(let j=0;j<3;j++)box(ventX,1.735+j*.145,wallZ+.835,1.90,.078,.083,'#808477',-.31);
        box(ventX,2.20,wallZ+.75,2.43,.13,.39,aggregate);
        box(ventX,2.277,wallZ+.75,2.43,.032,.38,'#d7dedc');
        // The continuous, low stone plinth meets the existing side sills below their openings.
        for(let row=0;row<3;row++)for(let i=0;i<9;i++){
          const start=Math.max(-wallZ,-wallZ+i*1.92-(row%2)*.67);
          const end=Math.min(wallZ,-wallZ+(i+1)*1.92-(row%2)*.67);
          if(end>start+.05)box(wing*(wallX+.28),.175+row*.303,(start+end)/2,.23,.276,end-start-.026,
            ['#827e6e','#918b78','#9e9987'][(i+row*2)%3],0,0,true);
        }
      }
      box(0,4.02,wallZ+.57,8.13,.17,.75,armour);
      box(0,4.24,wallZ+.49,8.84,.32,1.26,concrete);
      box(0,4.422,wallZ+.56,8.90,.055,1.20,'#e1e7e5');
      // The front upper storey is solid behind the existing facade modules. Dress
      // this face only; the open side windows still look out across the pass.
      const baySkin=new T.PlaneGeometry(17.98,3.99);
      add(baySkin,0,6.015,wallZ+.424,'#fffdf4');
      const bayUv=baySkin.getAttribute('uv'),bayPositions=baySkin.getAttribute('position');
      for(let i=0;i<bayUv.count;i++){
        const x=(bayPositions.getX(i)+8.99)/17.98,y=(8.01-bayPositions.getY(i))/3.99;
        bayUv.setXY(i,(4.5+x*1007)/1024,1-(260.5+y*223)/672);
      }
      for(const x of [-6.67,-2.80,2.80,6.67]){
        box(x,7.23,wallZ+.50,1.85,.13,.31,'#8c8978');
        box(x,7.30,wallZ+.53,1.90,.033,.33,'#c6c9b9');
        box(x,4.97,wallZ+.49,1.87,.095,.26,'#8d9082');
      }
      const pediment=new T.BufferGeometry();
      pediment.setAttribute('position',new T.Float32BufferAttribute([-9.3,8.32,0,9.3,8.32,0,0,10.64,0],3));
      pediment.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.5,1],2));
      pediment.setIndex([0,1,2]);pediment.computeVertexNormals();
      add(pediment,0,0,wallZ+.55,'#f8f6e9');
      const gableUv=pediment.getAttribute('uv');
      gableUv.setXY(0,5/1024,1-660/672);gableUv.setXY(1,1010/1024,1-660/672);gableUv.setXY(2,507/1024,1-493/672);
      // Low armoured observation bell set into a snow-lipped collar on the west roof shoulder.
      const cx=-4.9,cz=-2.6,seat=upper+1.85;
      add(new T.CylinderGeometry(1.72,1.92,.72,24),cx,seat-.24,cz,aggregate);
      add(new T.CylinderGeometry(1.74,1.76,.105,24),cx,seat+.12,cz,'#d7e0df');
      const profile=[[1.47,0],[1.47,.37],[1.40,.67],[1.19,.93],[.89,1.15],[.47,1.29],[.002,1.34]];
      add(new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),24),cx,seat+.12,cz,armour);
      add(new T.CylinderGeometry(1.48,1.49,.085,24),cx,seat+.25,cz,'#434b46');
      for(let i=0;i<5;i++){
        const a=(i-2)*.62;
        const port=new T.BoxGeometry(.37,.105,.09).rotateY(a);
        add(port,cx+1.445*Math.sin(a),seat+.59,cz+1.445*Math.cos(a),'#333d38');
      }
    }
    if(alpine){
      const run=wallX+.5;
      for(const slope of [-1,1]){
        const snow=new T.PlaneGeometry(1,1,5,18).rotateX(-Math.PI/2);
        const positions=snow.getAttribute('position');
        for(let index=0;index<positions.count;index++){
          const span=positions.getZ(index)+.5,u=positions.getX(index)+.5;
          const down=slope>0?u:1-u;
          const z=(span-.5)*(b.d+.98);
          // Uneven buildup under the ridge allows the windward slates to show.
          const boundary=.65+slope*.13+.09*Math.sin(span*12+number)+.042*Math.cos(span*36-number);
          const x=slope*run*down*boundary;
          const surface=upper+.30+2.4*(1-Math.abs(x)/run);
          positions.setXYZ(index,x,surface+.025+.067*(1-down)**.6,z);
        }
        snow.computeVertexNormals();
        add(snow,0,0,0,slope>0?'#e7edf0':'#dce5e9');
      }
    }
    for(const side of [-1,1]){
      const face=side*gableZ;
      // The pitched roof is already part of the map. Bargeboards follow its actual 2.4 m rise.
      const run=wallX+.52,angle=Math.atan2(2.4,run);
      for(const wing of [-1,1]){
        box(wing*run/2,upper+1.51,face,Math.hypot(run,2.4)+.10,.16,.18,
          fortress?'#899083':alpine?timber:shed?brick:stone,0,-wing*angle);
      }
      if(fortress){
        box(0,upper+1.18,face,2.74,.78,.17,'#888b7e');
        box(0,upper+1.16,face+side*.11,2.39,.56,.10,'#455148');
        for(let n=0;n<4;n++)box(0,upper+.97+n*.13,face+side*.18,2.28,.054,.10,'#81897a',-side*.23,0,true);
      }else if(alpine){
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
            add(new T.CylinderGeometry(.265,.18,.42,6),x,2.87,lampZ,'#d9ccb1',0,0,false,1.55);
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
          add(new T.BoxGeometry(1.72,.045,.115),boardX,2.885,boardZ+.115,'#cfb689',0,0,false,.67);
          box(boardX,1.02,boardZ+.06,2.48,.11,.24,stone);
          const paper=new T.TextureLoader().load('/shooter/environment/deutz-abfahrt.webp');
          paper.colorSpace=T.SRGBColorSpace;paper.anisotropy=4;
          const print=new T.MeshStandardMaterial({map:paper,roughness:.91,emissive:'#e5bc83',emissiveMap:paper,emissiveIntensity:0});
          night.papers.push(print);timetable=new T.Mesh(new T.PlaneGeometry(2.24,1.68),print);
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
      }else if(cinema&&side===1){
        const wine='#623e3b',bronze='#988462',ivory='#d8ccb0',green='#41524d';
        const front=wallZ+.58;
        // The poster vitrines already occupy the flanks. Fluted portal jambs sit on the solid
        // ends of the wall, beyond the four-metre opening and above the pavement.
        for(const wing of [-1,1]){
          const jamb=wing*2.28;
          box(jamb,1.75,front,.44,3.50,.38,green);
          box(jamb,.28,front+.03,.52,.56,.43,'#655d54');
          for(const dx of [-.11,0,.11])box(jamb+dx,1.97,front+.21,.037,2.68,.055,bronze,0,0,true);
          box(jamb,3.48,front,.56,.21,.49,ivory);
          // Vertical opal glass sconces light the ends of the poster cases.
          const x=wing*8.18;
          box(x,2.13,front,.31,1.42,.23,green);
          add(new T.CylinderGeometry(.15,.15,1.18,8),x,2.13,front+.18,ivory,0,0,false,1.05);
          for(const y of [1.51,2.75])box(x,y,front+.11,.40,.10,.43,bronze);
          // Upper-floor masonry bands taper toward the centre above the existing marquee.
          for(let line=0;line<3;line++){
            const length=3.35-line*.49;
            box(wing*(2.12+length/2),5.34+line*.23,front,length,.095,.14,bronze);
          }
        }
        // A fanlight and its radiating glazing bars bridge the canopy and upper storey.
        const fanY=5.16,fanZ=front+.08,radius=1.76;
        const fan=new T.Shape();
        fan.moveTo(-radius,0);fan.absarc(0,0,radius,Math.PI,0,true);fan.closePath();
        const fanGeometry=new T.ShapeGeometry(fan,20);
        add(fanGeometry,0,fanY,fanZ,'#42504a',0,0,false,.12);
        add(new T.BoxGeometry(3.56,.049,.15),0,3.64,wallZ+1.72,ivory,0,0,false,.83);
        box(0,fanY,fanZ,3.72,.12,.19,ivory);
        for(let i=0;i<9;i++){
          const a=Math.PI*i/8,x=Math.cos(a),y=Math.sin(a);
          box(x*radius/2,fanY+y*radius/2,fanZ+.047,radius,.051,.06,bronze,0,a);
          if(i<8){
            const middle=a+Math.PI/16;
            box(Math.cos(middle)*radius,fanY+Math.sin(middle)*radius,fanZ+.025,
              2*radius*Math.tan(Math.PI/16),.10,.11,ivory,0,middle+Math.PI/2);
          }
        }
        // The tall blade sign gets its lettering from raised metal strokes; no extra texture or draw.
        const bladeX=6.98,bladeZ=front+.48;
        box(bladeX,7.46,bladeZ,1.20,6.18,.55,wine);
        for(const wing of [-1,1]){
          box(bladeX+wing*.60,7.53,bladeZ,.095,6.07,.64,bronze);
          box(bladeX+wing*.78,7.20,bladeZ-.10,.16,5.75,.32,green);
        }
        box(bladeX,10.61,bladeZ,.90,.18,.56,bronze);
        box(bladeX,10.76,bladeZ,.53,.17,.46,ivory);
        const letterZ=bladeZ+.305;
        function stroke(y:number,x1:number,y1:number,x2:number,y2:number){
          add(new T.BoxGeometry(Math.hypot(x2-x1,y2-y1),.085,.048),bladeX+(x1+x2)/2,y+(y1+y2)/2,letterZ,ivory,0,Math.atan2(y2-y1,x2-x1),false,.72);
        }
        const left=-.30,right=.30,top=.42,bottom=-.42;
        stroke(9.55,left,bottom,left,top);stroke(9.55,left,-.05,right,top);stroke(9.55,-.17,.05,right,bottom);
        stroke(8.26,0,bottom,0,top);stroke(8.26,-.22,top,.22,top);stroke(8.26,-.22,bottom,.22,bottom);
        stroke(6.97,left,bottom,left,top);stroke(6.97,left,top,right,bottom);stroke(6.97,right,bottom,right,top);
        for(let i=0;i<12;i++){
          const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
          stroke(5.68,.33*Math.cos(a),.44*Math.sin(a),.33*Math.cos(b),.44*Math.sin(b));
        }
        // Flush stone flags laid in a runner from the street; offset rows reveal the coursing.
        const stoneTones=['#858479','#918d80','#807e75','#969185'];
        for(let row=0;row<5;row++){
          const offset=row%2?.58:0;
          for(let col=-3;col<=2;col++){
            const lo=Math.max(-2.9,col*1.16+offset),hi=Math.min(2.9,(col+1)*1.16+offset);
            if(hi-lo>.05)box((lo+hi)/2,.024,wallZ+.92+row*.83,hi-lo-.024,.046,.81,stoneTones[(row+col+4)%4]);
          }
        }
        for(const wing of [-1,1]){
          box(wing*3.02,.026,wallZ+2.58,.18,.050,4.16,green);
          box(wing*3.16,.026,wallZ+2.58,.055,.050,4.16,bronze);
        }
        box(0,.027,wallZ+4.73,6.25,.052,.12,green);
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
      const mesh=new T.Mesh(geometry,trim);mesh.receiveShadow=true;
      if(details&&timetable)mesh.add(timetable);
      lod.addLevel(mesh,distance,.10);
    }
    for(const geometry of [...broad,...close])geometry.dispose();
    group.add(lod);
    if(illuminated){
      // Faint, feathered spill directly on the stone and paving, kept off doors and sign faces.
      const positions:number[]=[],rgba:number[]=[];
      function pool(x:number,y:number,z:number,w:number,h:number,floor:boolean,intensity:number){
        function point(r:number,a:number){
          positions.push(x+w*r*Math.cos(a),floor?y:y+h*r*Math.sin(a),floor?z-h*r*Math.sin(a):z);
          rgba.push(1,.57,.24,intensity*(1-r)*(1-r));
        }
        for(let row=0;row<3;row++)for(let i=0;i<20;i++){
          const a=i*Math.PI/10,next=(i+1)*Math.PI/10,inner=row/3,outer=(row+1)/3;
          point(inner,a);point(outer,a);point(outer,next);
          if(row){point(inner,a);point(outer,next);point(inner,next);}
        }
      }
      for(const side of [-1,1]){
        const x=side*(deutz?7.65:8.18);
        pool(x,deutz?2.68:2.12,wallZ+.585,deutz?1.12:.71,deutz?1.18:1.05,false,.15);
        pool(x,.084,wallZ+1.68,1.65,1.20,true,.10);
      }
      if(cinema)pool(0,.084,wallZ+2.23,2.08,1.65,true,.105);
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(rgba,4));
      const spill=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
      spill.position.copy(lod.position);spill.name='Night pools from period entrance lamps';spill.visible=false;
      night.pools.push(spill);group.add(spill);
    }
  }
  return group;
}
