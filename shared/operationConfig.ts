export type Difficulty='easy'|'normal'|'hard';
export type Mission='sabotage'|'documents'|'hold';
export type Condition='standard'|'fog'|'night'|'routes';
export type OperationConfig={kind:'multiplayer'|'solo'|'coop';mode:'training'|'battle'|'survival'|'mission';difficulty:Difficulty;battleStyle:'team'|'alone';enemies:number;mission:Mission;condition:Condition|'random'};
export const defaultOperation:OperationConfig={kind:'multiplayer',mode:'battle',difficulty:'normal',battleStyle:'team',enemies:4,mission:'sabotage',condition:'standard'};
export const modeLabels={training:'Training',battle:'Bot-Gefecht',survival:'Überleben',mission:'Missionen'};
export const difficultyLabels={easy:'Leicht',normal:'Normal',hard:'Schwer'};
export const missionLabels={sabotage:'Funkstation sabotieren',documents:'Dokumente bergen',hold:'Stellung halten'};
export const conditionLabels={standard:'Standard',fog:'Nebel',night:'Nacht',routes:'Wechselnde Zugänge',random:'Zufällig'};
export const difficultyRules={
 easy:{reaction:750,error:3,vision:35,coopDamage:.55,burstSize:2,burstPause:1100},
 normal:{reaction:400,error:1.5,vision:55,coopDamage:.70,burstSize:3,burstPause:850},
 hard:{reaction:200,error:.7,vision:75,coopDamage:.85,burstSize:4,burstPause:600},
};
export function parseOperation(value:unknown):OperationConfig{
 if(value===undefined)return {...defaultOperation};
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Ungültige Einsatzkonfiguration');
 const c={...defaultOperation,...value} as OperationConfig;
 if(!['multiplayer','solo','coop'].includes(c.kind)||!Object.hasOwn(modeLabels,c.mode)||!Object.hasOwn(difficultyLabels,c.difficulty)||!['team','alone'].includes(c.battleStyle)||!Number.isInteger(c.enemies)||c.enemies<1||c.enemies>4||!Object.hasOwn(missionLabels,c.mission)||!Object.hasOwn(conditionLabels,c.condition))throw Error('Ungültige Einsatzkonfiguration');
 if(c.kind==='multiplayer'&&c.mode!=='battle'||c.kind==='coop'&&!['survival','mission'].includes(c.mode))throw Error('Dieser Spielmodus ist für die Einsatzart nicht verfügbar');
 if(c.mode==='battle'&&c.battleStyle==='team')c.enemies=4;
 return c;
}
