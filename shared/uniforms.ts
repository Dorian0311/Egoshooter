import type {MapId} from './world.ts';

export const uniforms = {
  'task-olive': {name:'Spezialkräfte · Olive',detail:'Taktischer Helm, Schutzweste, Funkgerät und olivfarbene Einsatzbekleidung.',color:'#58684c',headgear:'helmet'},
  'task-sand': {name:'Spezialkräfte · Sand',detail:'Taktischer Helm, Schutzweste, Funkgerät und sandfarbene Einsatzbekleidung.',color:'#a09272',headgear:'helmet'},
  'de-panzer': {name:'Heer · Panzerbesatzung', detail:'Schwarze Panzerbekleidung, Feldmütze und rosa Waffenfarbe.', color:'#303135', headgear:'cap'},
  'de-greatcoat': {name:'Heer · Texturierter Mantel', detail:'Importiertes Mantelmodell mit Stofffalten, Koppel, Taschen und Handschuhen.', color:'#626858', headgear:'helmet'},
  'de-field': {name:'Heer · Felduniform', detail:'Feldgraue Bekleidung, Stahlhelm und Lederkoppel.', color:'#626858', headgear:'helmet'},
  'us-field': {name:'US Army · Felduniform', detail:'Olivfarbene Feldbekleidung, M1-Helm und Webausrüstung.', color:'#79785a', headgear:'helmet'},
  'fr-alpine': {name:'France · Chasseurs alpins', detail:'Dunkle Gebirgsbekleidung, große schwarze Tarte mit Jagdhorn.', color:'#303e50', headgear:'beret'},
  'fr-liberation': {name:'France · Ausrüstung 1944–45', detail:'US-geprägte khakifarbene Bekleidung mit französischer Tarte und Jagdhorn.', color:'#7a775c', headgear:'beret'},
  'deadpool': {name:'Bonus · Deadpool', detail:'Optionaler Charakter-Skin. Gleiche Spielwerte und Trefferzonen wie die Uniformen.', color:'#8a2424', headgear:'none'},
  'harley': {name:'Bonus · Harley Quinn', detail:'Optionaler Charakter-Skin. Gleiche Spielwerte und Trefferzonen wie die Uniformen.', color:'#b84e70', headgear:'none'},
  'rocket': {name:'Bonus · Rocket', detail:'Optionaler Charakter-Skin, auf Spielergröße skaliert. Gleiche Spielwerte und Trefferzonen.', color:'#807564', headgear:'none'},
  'commander': {name:'Bonus \u00b7 Commander 1946', detail:'Fiktive Spielfigur aus Wolfenstein: The Old Blood. Feste K\u00f6rperpose; gleiche Spielwerte und Trefferzonen.', color:'#343730', headgear:'none'},
  'leatherface': {name:'Bonus · Leatherface', detail:'Nur Kettensäge · 2,2 m Reichweite. Angriff halten: 2,2 Sekunden Powermodus mit hohem Tempo, danach 7 Sekunden Erholung.', color:'#88734b', headgear:'none'},
  'homer': {name:'Bonus · Homer Simpson', detail:'Optionaler Charakter-Skin. Gleiche Spielwerte und Trefferzonen wie die Uniformen.', color:'#e3c650', headgear:'none'},
} as const;
export type UniformId=keyof typeof uniforms;
export function uniformOptions(team:'de'|'fr',map:MapId):UniformId[]{
  const historical:UniformId[]=map==='storm'?[team==='de'?'task-olive':'task-sand']:team==='de'?['de-panzer','de-field','de-greatcoat']:map==='alpine'?['fr-alpine','fr-liberation']:['us-field'];
  return [...historical,'deadpool','harley','rocket','homer','leatherface','commander'];
}
export function defaultUniform(team:'de'|'fr',map:MapId):UniformId{return uniformOptions(team,map)[0];}
export function validUniform(value:unknown,team:'de'|'fr',map:MapId):value is UniformId{
  return typeof value==='string'&&uniformOptions(team,map).includes(value as UniformId);
}
