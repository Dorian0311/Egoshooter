export type ResidentArchetype='macho'|'veteran'|'officer';
export type ResidentLook='bruiser'|'veteran'|'officer'|'showman';
type ResidentProfile={name:string;archetype:ResidentArchetype;look:ResidentLook;skinTone:string;biography:string};

export const residentRoles:Record<ResidentArchetype,{label:string;rate:number;pitch:number;lines:readonly string[]}>= {
 macho:{label:'Großmaul',rate:1,pitch:.93,lines:[
  'Where the women at? I rehearsed one pickup line and forgot the fucking thing.',
  'I fear nothing. Except commitment and whatever the fuck is making that noise.',
  'These muscles are decorative. Read the fucking warranty.',
  'I would kick that door in, but my chiropractor said no more hero shit.',
  'I came to kick ass. My knees filed an objection.',
  'That crater? Definitely my entrance. Absolutely not me shitting myself.',
  'Relax. I have a plan. Step one: find somebody with a fucking plan.',
  'Tell them I died flexing. Leave out the screaming.',
  'I could carry this whole squad. Emotionally? Fuck no.',
  'My ego needs its own bunker. Apparently that counts as a structural defect.',
  'I am the main attraction. The artillery can wait its fucking turn.',
  'I was born ready. The paperwork says otherwise.',
 ]},
 veteran:{label:'Veteran',rate:.88,pitch:.83,lines:[
  'I survived three commanders. The bullets were the reasonable ones.',
  'The brochure said adventure. This is a fucking plumbing emergency with guns.',
  'Keep your head down. Funerals are expensive and I hate speeches.',
  'Good news: the briefing was bullshit. Bad news: so was the fucking evacuation.',
  'If this is character building, I would like to remain a shallow bastard.',
  'The medic said avoid stress. I asked him which fucking continent.',
  'I am not pessimistic. I have just read the casualty forms in advance.',
  'My retirement plan is not becoming a fucking landmark.',
  'Nothing says secure position like fresh paint over the bullet holes.',
  'They promised hot meals. Technically, a burning field kitchen qualifies.',
  'The afterlife had better accept complaints. I have a fucking list.',
  'Another glorious operation. Same shit, different map.',
 ]},
 officer:{label:'Überforderter Offizier',rate:1.12,pitch:1.08,lines:[
  'Nobody panic! That is an order! Who the fuck issued that order? Oh. Me.',
  'We are not surrounded. We have opportunities in every fucking direction.',
  'Strategic withdrawal! Apparently running like hell requires a longer name.',
  'Who signed off on this shit? Do not check the signature.',
  'The map says safe. The map is a lying piece of shit.',
  'I need a head count. Preferably with everyone still attached.',
  'That was a warning shot. The building misunderstood.',
  'The plan is classified. Mostly because I cannot find the fucking thing.',
  'Please form an orderly queue for the complete collapse of command.',
  'We have lost communication, direction and the bastard with the biscuits.',
  'The chain of command is now a fucking suggestion.',
  'Report says minor damage. The roof is in another postcode.',
 ]},
};

/** Fictional residents. Background and appearance grant no gameplay traits. */
export const residentCast:readonly ResidentProfile[]=[
 {name:'Bruno Weber',archetype:'macho',look:'bruiser',skinTone:'#ffffff',biography:'Mechaniker und selbsternannter Held. Seine große Klappe ist zuverlässiger als sein Mut.'},
 {name:'David Adler',archetype:'veteran',look:'veteran',skinTone:'#b9b0a4',biography:'Jüdischer ehemaliger Sanitäter. Hilfsbereit, kriegsmüde und mit einem staubtrockenen Kommentar für jedes Desaster.'},
 {name:'Samuel Rosen',archetype:'officer',look:'officer',skinTone:'#77736e',biography:'Schwarzer jüdischer Funkoffizier auf Heimaturlaub. Versucht, selbst das größte Chaos noch mit einem Dienstplan zu bezwingen.'},
 {name:'Elias König',archetype:'macho',look:'showman',skinTone:'#dbd1c3',biography:'Bühnenarbeiter und Hobbyboxer. Verkauft jede peinliche Panne als spektakulären Auftritt.'},
];

export function residentProfile(id:string):ResidentProfile{
 const suffix=Number(id.match(/\d+$/)?.[0]??0),index=Number.isSafeInteger(suffix)?suffix%residentCast.length:0;
 return residentCast[index];
}
export function residentName(id:string){const p=residentProfile(id);return `${p.name} · ${residentRoles[p.archetype].label}`;}
