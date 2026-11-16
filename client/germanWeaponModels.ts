import * as T from 'three';

export const germanWeaponNames:Record<number,string>={7:'stg44',8:'gewehr43',9:'mg42',10:'mp34',11:'p38',12:'fg42'};
export function germanWeaponId(name:string){return Object.keys(germanWeaponNames).map(Number).find(id=>germanWeaponNames[id]===name);}

/** Original game meshes in metres, grip at the origin and muzzle along +Z. */
export function createGermanWeapon(id:number):T.Group {
  if(!germanWeaponNames[id])throw Error(`Unknown German weapon: ${id}`);
  const root=new T.Group();root.name=germanWeaponNames[id];
  const steel=new T.MeshStandardMaterial({color:0x414a48,metalness:.82,roughness:.38}),dark=new T.MeshStandardMaterial({color:0x242a29,metalness:.72,roughness:.5}),wood=new T.MeshStandardMaterial({color:id===10?0x755333:0x68432d,roughness:.72}),grip=new T.MeshStandardMaterial({color:0x332b27,roughness:.58});
  function mesh(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number,name:string){const m=new T.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,material=steel,name='receiver'){return mesh(new T.BoxGeometry(w,h,d),material,x,y,z,name);}
  function tube(x:number,y:number,z:number,r:number,length:number,material=steel,name='barrel'){const m=mesh(new T.CylinderGeometry(r,r,length,12),material,x,y,z,name);m.rotation.x=Math.PI/2;return m;}
  function stock(length:number,height:number){
    const shape=new T.Shape();shape.moveTo(-length,-.13);shape.lineTo(-length,.025);shape.lineTo(-.05,.055);shape.lineTo(.12,.005);shape.lineTo(.05,-.055);shape.lineTo(-.10,-.045);shape.lineTo(-length,-height);shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth:.052,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:2,steps:1});g.rotateY(-Math.PI/2);g.translate(.026,0,0);return mesh(g,wood,0,0,0,'wood-stock');
  }
  function sights(front:number){box(0,.098,.035,.014,.035,.03,dark,'rear-sight');box(0,.10,front,.012,.045,.014,dark,'front-sight');}
  function trigger(){const m=mesh(new T.TorusGeometry(.029,.004,5,12,Math.PI*1.75),dark,0,-.056,.012,'trigger-guard');m.rotation.y=Math.PI/2;box(0,-.048,.02,.008,.028,.012,dark,'trigger');}
  if(id===11){
    box(0,.045,.09,.034,.033,.19,steel,'p38-slide');tube(0,.043,.174,.012,.13,dark);box(0,-.035,-.012,.038,.115,.055,grip,'p38-grip').rotation.x=-.18;box(0,.024,.035,.04,.028,.12,steel);sights(.21);trigger();
    for(let n=0;n<6;n++)box(.019,-.065+n*.012,-.012,.002,.003,.042,dark,'grip-ridge');
    root.userData.muzzle=[0,.043,.24];root.userData.sightY=.118;return root;
  }
  const rifle=id===8,mp=id===10,mg=id===9,fg=id===12;
  const muzzle=rifle?.83:mg?.91:mp?.59:fg?.70:.66;
  stock(mg?.32:rifle?.31:.28,mg?.12:.15);
  box(0,.035,.13,mg?.064:.052,mg?.08:.075,rifle?.35:.29,steel);
  tube(0,.054,(muzzle+.2)/2,.014,muzzle-.2,dark);
  tube(0,.054,muzzle-.024,.019,.048,steel,'muzzle');
  if(rifle){box(0,-.006,.36,.058,.055,.57,wood,'wood-handguard');box(0,.045,.32,.045,.045,.25,wood,'upper-handguard');box(.034,.055,.085,.028,.014,.085,steel,'bolt-handle');box(0,-.055,.11,.046,.10,.08,dark,'magazine');}
  else if(mg){
    tube(0,.052,.53,.034,.60,steel,'ventilated-shroud');
    for(let n=0;n<13;n++){for(const side of [-1,1])box(side*.034,.055,.27+n*.039,.003,.026,.018,dark,'shroud-slot');}
    tube(-.075,-.017,.16,.068,.09,dark,'belt-drum').rotation.z=Math.PI/2;box(-.041,.018,.15,.07,.016,.06,steel,'feed-tray');
    for(const side of [-1,1])box(side*.047,-.018,.68,.013,.018,.36,dark,'folded-bipod');
    box(0,-.07,-.005,.045,.13,.065,wood,'pistol-grip').rotation.x=-.18;
  }else if(mp){
    tube(0,.04,.2,.031,.35,steel,'tubular-receiver');box(0,-.018,.16,.055,.05,.30,wood,'wood-handguard');box(-.115,.026,.22,.22,.04,.065,dark,'side-magazine');
    for(let n=0;n<6;n++)tube(0,.055,.41+n*.022,.024,.009,steel,'barrel-cooling-ring');
  }else{
    box(0,-.012,.3,.057,.066,.22,fg?wood:dark,'handguard');box(0,-.078,0,.044,.135,.06,fg?wood:grip,'pistol-grip').rotation.x=-.22;
    if(fg){box(-.095,.02,.15,.18,.04,.09,dark,'side-magazine');for(const side of [-1,1])box(side*.038,-.012,.54,.012,.018,.26,dark,'folded-bipod');}
    else for(let n=0;n<5;n++){const m=box(0,-.08-n*.033,.12+n*n*.004,.044,.038,.085,dark,'curved-magazine');m.rotation.x=-n*.09;}
    for(let n=0;n<5;n++)box(.030,.014,.23+n*.031,.002,.028,.012,steel,'handguard-vent');
    tube(0,.087,.38,.011,.39,steel,'gas-tube');
  }
  sights(muzzle-.055);trigger();
  box(.032,.055,.035,.034,.015,.02,steel,'charging-handle');
  root.userData.muzzle=[0,.054,muzzle];root.userData.sightY=.122;
  return root;
}
