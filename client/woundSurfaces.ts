import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {BodyPart} from '../shared/injuries';

// A single bounded procedural texture is shared by all instances and detached pieces.
let detail:T.DataTexture|undefined;
function woundDetail(){
 if(detail)return detail;const size=128,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const thread=Math.sin(x*.47+Math.sin(y*.13)*2)*Math.sin(y*.16),grain=Math.sin(x*17.13+y*43.71)*Math.sin(x*3.71-y*9.17),value=Math.round(128+thread*35+grain*21),index=(y*size+x)*4;pixels[index]=pixels[index+1]=pixels[index+2]=value;pixels[index+3]=255;}
 detail=new T.DataTexture(pixels,size,size);detail.wrapS=detail.wrapT=T.RepeatWrapping;detail.magFilter=detail.minFilter=T.LinearFilter;detail.needsUpdate=true;return detail;
}
export function createWoundMaterial(){return new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.47,metalness:.035,side:T.DoubleSide,bumpMap:woundDetail(),bumpScale:.0022});}

/** Closed, irregular tissue surface, paired bones and connective fibres in one draw. */
export function createWoundGeometry(part:BodyPart,radius:number){
 const segments=28,rings=5,depth=radius*.12,top=radius*.035,positions:number[]=[0,top,0],colors:number[]=[],indices:number[]=[],color=new T.Color();
 const vertexColor=(hex:string,variation=1)=>{color.set(hex).multiplyScalar(variation);colors.push(color.r,color.g,color.b);};vertexColor('#70202b');
 for(let ring=1;ring<=rings;ring++)for(let n=0;n<segments;n++){const angle=n/segments*Math.PI*2,edge=1+.045*Math.sin(angle*7)+.025*Math.cos(angle*11),r=radius*ring/rings*edge,y=top+Math.sin(angle*9+ring)*radius*.025-(ring===rings?top:0);positions.push(Math.cos(angle)*r,y,Math.sin(angle)*r);vertexColor(ring===rings?'#371119':ring%2?'#842b37':'#571520',.82+.18*Math.cos(angle*5+ring));}
 for(let n=0;n<segments;n++)indices.push(0,1+(n+1)%segments,1+n);
 for(let ring=1;ring<rings;ring++)for(let n=0;n<segments;n++){const a=1+(ring-1)*segments+n,b=1+(ring-1)*segments+(n+1)%segments,c=1+ring*segments+n,d=1+ring*segments+(n+1)%segments;indices.push(a,b,c,b,d,c);}
 const bottom=positions.length/3;positions.push(0,-depth,0);vertexColor('#321018');
 for(let n=0;n<segments;n++){const top=1+(rings-1)*segments+n;positions.push(positions[top*3],-depth,positions[top*3+2]);vertexColor('#44111b');}
 for(let n=0;n<segments;n++){const a=1+(rings-1)*segments+n,b=1+(rings-1)*segments+(n+1)%segments,c=bottom+1+n,d=bottom+1+(n+1)%segments;indices.push(a,b,c,b,d,c,bottom,c,d);}
 const surface=new T.BufferGeometry();surface.setAttribute('position',new T.Float32BufferAttribute(positions,3));surface.setAttribute('color',new T.Float32BufferAttribute(colors,3));surface.setAttribute('uv',new T.Float32BufferAttribute(Array.from({length:positions.length/3},(_,n)=>[(positions[n*3]/radius+1)/2,(positions[n*3+2]/radius+1)/2]).flat(),2));surface.setIndex(indices);surface.computeVertexNormals();
 const pieces:T.BufferGeometry[]=[surface.toNonIndexed()];surface.dispose();
 const add=(geometry:T.BufferGeometry,hex:string)=>{const g=geometry.index?geometry.toNonIndexed():geometry,attribute=g.getAttribute('position'),paint=new Float32Array(attribute.count*3);color.set(hex);for(let n=0;n<attribute.count;n++){const variation=.88+.12*Math.sin(attribute.getY(n)*210+n*.31);paint[n*3]=color.r*variation;paint[n*3+1]=color.g*variation;paint[n*3+2]=color.b*variation;}g.setAttribute('color',new T.BufferAttribute(paint,3));pieces.push(g);if(g!==geometry)geometry.dispose();};
 const pair=part.startsWith('arm')||part.startsWith('leg');
 for(let n=0;n<(pair?2:1);n++){const bone=new T.CylinderGeometry(radius*(pair?.13:.16),radius*(pair?.15:.19),radius*(part==='head'?.14:.28),11,1,false);bone.rotateZ((n===0?1:-1)*.11);bone.translate(pair?(n===0?-radius*.24:radius*.24):0,radius*(part==='head'?.07:.14),0);add(bone,'#d1b99c');}
 for(let n=0;n<3;n++){const angle=n*2.3+.4,fibre=new T.CapsuleGeometry(radius*.035,radius*(.16+n*.025),2,5);fibre.rotateZ(Math.sin(angle)*.2);fibre.translate(Math.cos(angle)*radius*.63,radius*.10,Math.sin(angle)*radius*.63);add(fibre,'#a54a54');}
 const merged=mergeGeometries(pieces,false)!;for(const piece of pieces)piece.dispose();merged.computeBoundingBox();merged.computeBoundingSphere();return merged;
}
