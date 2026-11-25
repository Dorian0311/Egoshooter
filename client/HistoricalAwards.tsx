import React from 'react';
import type {Snapshot} from '../shared/game';
import {earnedHistoricalAwards,historicalAwards} from '../shared/historicalAwards';
import './historicalAwards.css';

const photos={
  infantry:{source:'German_infantry_assault_badge,_or_Infanterie-Sturmabzeichen_(FindID_111044).jpg',
    author:'Portable Antiquities Scheme / Trustees of the British Museum',license:'by-sa/4.0'},
  wound:{source:'Verwundetenabzeichen_(WW2_German_Wound_Badge_Black_1939_reverse).jpg',
    author:'A. Nilssen Photography',license:'by-sa/2.0'},
  cross:{source:'Iron_Cross_(1939),_2nd_class,_with_black_core_paint_missing_-_04_back.jpg',
    author:'Lieberraldus',license:'by-sa/4.0'},
  merit:{source:'2011-115-1_Medal,_War_Merit_Cross,_Germany,_Reverse_(5737939960).jpg',
    author:'Naval History & Heritage Command',license:'by/2.0'},
} as const;

export function HistoricalAwards({snapshot,player}:{snapshot:Snapshot;player:Snapshot['players'][number]|undefined}){
  const awards=earnedHistoricalAwards(snapshot,player);
  if(!awards.length)return null;
  return <section className="historical-awards" aria-label="Verdiente Auszeichnungen">
    <h3>Verdiente Auszeichnungen</h3>
    <ul>{awards.map(key=>{
      const award=historicalAwards[key],photo=photos[key];
      const source='https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(photo.source);
      return <li key={key}>
        <a className="historical-award-photo" href={source} target="_blank" rel="noreferrer" aria-label={`Archivfoto öffnen · ${award.name}`}>
          <img src={`/shooter/awards/${key}.jpg`} alt="" width={64} height={72}/>
        </a>
        <div><strong>{award.name}</strong><small>{award.reason}</small>
          <small className="historical-award-credit"><a href={source} target="_blank" rel="noreferrer">{photo.author}</a>
            {' · '}<a href={`https://creativecommons.org/licenses/${photo.license}/`} target="_blank" rel="noreferrer">Bildlizenz</a></small>
        </div>
      </li>;
    })}</ul>
  </section>;
}
