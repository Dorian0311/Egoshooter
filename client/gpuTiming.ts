type TimerExtension={TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};

/** Nonblocking GPU feedback. A small query pool avoids allocating every frame;
 * unsupported/disjoint/lost contexts fall back to normal frame-time control. */
export function createGpuTiming(gl:WebGL2RenderingContext){
 let extension=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;
 const pending:WebGLQuery[]=[],free:WebGLQuery[]=[];
 let active:WebGLQuery|null=null,lost=false;
 const state={supported:!!extension,ms:undefined as number|undefined,samples:0};
 function reset(){
  if(!gl.isContextLost()){
   if(active&&extension)gl.endQuery(extension.TIME_ELAPSED_EXT);
   for(const query of [...pending,...free,...(active?[active]:[])])gl.deleteQuery(query);
  }
  pending.length=free.length=0;active=null;state.ms=undefined;state.samples=0;
 }
 function poll(){
  if(gl.isContextLost()){reset();lost=true;return;}
  if(lost){extension=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;state.supported=!!extension;lost=false;}
  if(!extension)return;
  while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
   if(gl.getParameter(extension.GPU_DISJOINT_EXT)){reset();return;}
   const query=pending.shift()!,ms=Number(gl.getQueryParameter(query,gl.QUERY_RESULT))/1e6;
   if(Number.isFinite(ms)&&ms>0&&ms<250){state.ms=state.ms===undefined?ms:state.ms+(ms-state.ms)*.15;state.samples++;}
   free.push(query);
  }
 }
 const onLost=()=>{lost=true;reset();};
 gl.canvas.addEventListener('webglcontextlost',onLost);
 return {
  state,poll,reset,
  begin(){
   if(!extension||lost||active||pending.length>=3)return;
   active=free.pop()??gl.createQuery();if(active)gl.beginQuery(extension.TIME_ELAPSED_EXT,active);
  },
  end(){if(active&&extension){if(!gl.isContextLost()){gl.endQuery(extension.TIME_ELAPSED_EXT);pending.push(active);}active=null;}},
  dispose(){reset();gl.canvas.removeEventListener('webglcontextlost',onLost);},
 };
}
