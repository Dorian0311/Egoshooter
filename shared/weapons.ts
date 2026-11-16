export type WeaponId = 0 | 1 | 2 | 3 | 4 | 7 | 8 | 9 | 10 | 11 | 12;
export type Loadout = [WeaponId, WeaponId, WeaponId, WeaponId, WeaponId];
export type WeaponKind = 'rifle' | 'pistol' | 'smg' | 'assault' | 'lmg' | 'melee' | 'special';
type Weapon = {name:string;kind:WeaponKind;mag:number;damage:number;interval:number;reload:number;spread:number;recoil:number;range:number};

// IDs 0–6 also appear in saved highlights and combat events; keep them stable.
export const weapons:readonly Weapon[] = [
  {name:'Karabiner 98k',kind:'rifle',mag:5,damage:65,interval:1100,reload:2600,spread:.001,recoil:.026,range:90},
  {name:'Luger P08',kind:'pistol',mag:8,damage:28,interval:310,reload:1600,spread:.004,recoil:.018,range:22},
  {name:'MP 40',kind:'smg',mag:30,damage:24,interval:85,reload:2400,spread:.009,recoil:.012,range:20},
  {name:'HK G36 (modern)',kind:'assault',mag:30,damage:27,interval:130,reload:2600,spread:.003,recoil:.022,range:55},
  {name:'Kettensäge',kind:'melee',mag:1,damage:38,interval:320,reload:0,spread:0,recoil:0,range:2.2},
  {name:'Wurfstern',kind:'special',mag:3,damage:40,interval:750,reload:0,spread:0,recoil:0,range:72},
  {name:'Körperteil',kind:'special',mag:1,damage:32,interval:800,reload:0,spread:0,recoil:0,range:2.65},
  {name:'StG 44',kind:'assault',mag:30,damage:32,interval:115,reload:2800,spread:.004,recoil:.019,range:60},
  {name:'Gewehr 43',kind:'rifle',mag:10,damage:52,interval:430,reload:2700,spread:.002,recoil:.029,range:85},
  {name:'MG 42',kind:'lmg',mag:50,damage:30,interval:60,reload:4800,spread:.013,recoil:.027,range:75},
  {name:'MP 34',kind:'smg',mag:32,damage:25,interval:125,reload:2600,spread:.007,recoil:.014,range:28},
  {name:'Walther P38',kind:'pistol',mag:8,damage:30,interval:285,reload:1700,spread:.004,recoil:.020,range:25},
  {name:'FG 42',kind:'lmg',mag:20,damage:39,interval:100,reload:3000,spread:.005,recoil:.025,range:70},
];
export const historicalWeaponIds:readonly WeaponId[] = [0,1,2,7,8,9,10,11,12];
export const selectableWeaponIds:readonly WeaponId[] = [...historicalWeaponIds,3,4];
export const defaultLoadout:Loadout = [0,1,2,7,8];
export function isWeaponId(value:unknown):value is WeaponId {
  return typeof value==='number'&&selectableWeaponIds.includes(value as WeaponId);
}
export function validLoadout(value:unknown,uniform?:string):value is Loadout {
  return Array.isArray(value)&&value.length===5&&new Set(value).size===5&&value.every(isWeaponId)&&(!value.includes(4)||uniform==='leatherface');
}
export function startingWeapon(loadout:Loadout,uniform:string):WeaponId {
  return loadout[0];
}
export function weaponSlot(loadout:Loadout,slot:number):WeaponId {
  return loadout[slot]??loadout[0];
}
/** Keep a selected pistol when possible; P08 remains the emergency sidearm. */
export function fallbackSidearm(loadout:Loadout,current?:WeaponId):WeaponId {
  if(current!==undefined&&loadout.includes(current)&&weapons[current].kind==='pistol')return current;
  return loadout.find(id=>weapons[id].kind==='pistol')??1;
}
