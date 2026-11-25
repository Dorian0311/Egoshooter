import * as T from 'three';

// A closed, terraced sea cliff. Its crown, exposed rock and wet base share a
// silhouette so the colour bands follow the folds of the headland.
export function coastalHeadland(seed:number){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const sections=40,stone=new T.Color(),rim=new T.Color();
 const rings=[
  {radius:1.04,height:-.16,color:'#5e7777'},
  {radius:1,height:.13,color:'#a98869'},
  {radius:.91,height:.5,color:'#c99574'},
  {radius:.88,height:.72,color:'#dec39a'},
  {radius:.79,height:.79,color:'#659261'},
  {radius:.59,height:.95,color:'#7da25c'},
  {radius:.30,height:1,color:'#85a769'},
 ];
 for(const [row,ring] of rings.entries()){
  for(let i=0;i<sections;i++){
   const a=i/sections*Math.PI*2;
   const fold=.12*Math.sin(3*a+seed)+.09*Math.cos(5*a-seed)+.055*Math.sin(9*a+.4);
   const radius=ring.radius*(1+fold);
   const crest=1+.25*Math.sin(2*a+seed)+.11*Math.cos(5*a-seed);
   positions.push(radius*Math.cos(a),ring.height*crest,radius*Math.sin(a));
   stone.set(ring.color).multiplyScalar(.94+.08*Math.sin(a*4+seed));
   colors.push(stone.r,stone.g,stone.b);
   if(row){
    const lower=(row-1)*sections+i,next=(row-1)*sections+(i+1)%sections;
    indices.push(lower,lower+sections,next,next,lower+sections,next+sections);
   }
  }
 }
 const peak=positions.length/3;positions.push(0,1.04,0);rim.set('#87aa68');colors.push(rim.r,rim.g,rim.b);
 for(let i=0;i<sections;i++)indices.push(peak,(rings.length-1)*sections+(i+1)%sections,(rings.length-1)*sections+i);
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 g.setIndex(indices);g.computeVertexNormals();return g;
}
