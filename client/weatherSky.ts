import * as T from 'three';

export type WeatherSky='fog'|'night';
export const weatherHorizon={fog:'#a9b4b5',night:'#2c394c'} as const;

// Bake the angular sky once per weather condition. The regular Three backdrop
// samples a 32px cube; weather adds no postprocessing, shadow pass or frame updates.
export function makeWeatherSky(weather:WeatherSky){
 const night=weather==='night',size=32;
 const horizon=new T.Color(weatherHorizon[weather]);
 const zenith=new T.Color(night?'#0a142a':'#8099a9');
 const glow=new T.Color(night?'#74615e':'#e3d9c6');
 const direction=new T.Vector3(),color=new T.Color(),faces:T.DataTexture[]=[];
 const sunBearing=new T.Vector3(-70,0,55).normalize();
 for(let face=0;face<6;face++){
  const data=new Uint8Array(size*size*4);
  for(let row=0;row<size;row++)for(let col=0;col<size;col++){
   const u=(col+.5)*2/size-1,v=(row+.5)*2/size-1;
   if(face===0)direction.set(1,-v,-u);
   else if(face===1)direction.set(-1,-v,u);
   else if(face===2)direction.set(u,1,v);
   else if(face===3)direction.set(u,-1,-v);
   else if(face===4)direction.set(u,-v,1);
   else direction.set(-u,-v,-1);
   direction.normalize();direction.x*=-1; // Three flips X when sampling an authored cube.
   const y=direction.y;
   const towardSun=Math.max(0,direction.dot(sunBearing));
   color.copy(horizon).lerp(zenith,T.MathUtils.smoothstep(y,-.015,.86));
   const band=Math.exp(-((y-(night?.095:.22))**2)/(night?.018:.085));
   const aboveHorizon=T.MathUtils.smoothstep(y,-.02,.10);
   color.lerp(glow,(night?.44:.64)*towardSun**4*band*aboveHorizon);
   color.convertLinearToSRGB();
   const offset=(row*size+col)*4;
   data[offset]=Math.round(color.r*255);data[offset+1]=Math.round(color.g*255);
   data[offset+2]=Math.round(color.b*255);data[offset+3]=255;
  }
  faces.push(new T.DataTexture(data,size,size));
 }
 const cube=new T.CubeTexture(faces);cube.name='sky-'+weather;cube.colorSpace=T.SRGBColorSpace;
 cube.generateMipmaps=false;cube.minFilter=cube.magFilter=T.LinearFilter;cube.needsUpdate=true;
 return cube;
}
