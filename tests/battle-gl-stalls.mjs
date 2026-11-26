// Test-only wall-clock timing around existing WebGL calls. Never asks the driver for extra state.
export function attachBattleGlStalls(renderer, clock=()=>performance.now()) {
  const gl=renderer.getContext();
  const events=[],frames=[];
  let eventCount=0,frameCount=0,context=null,start=0,composer=0,shadowMs=0,inShadow=false,active=false;
  const programs=new WeakMap();
  let nextProgramId=0;
  const programCalls=new Set(['linkProgram','getProgramParameter','getProgramInfoLog','getUniformLocation','getAttribLocation','useProgram']);
  function shaderVariant(program){
    if(!program)return undefined;
    if(!programs.has(program))programs.set(program,++nextProgramId);
    const [camera,,geometry,material,object,group]=context??[];
    const source=Array.isArray(object?.material)?object.material[group?.materialIndex??0]:object?.material;
    return {
      programId:programs.get(program),camera:camera?.type,geometry:geometry?.type,materialIndex:group?.materialIndex,
      attributes:geometry?Object.keys(geometry.attributes).sort():undefined,
      source:source&&{type:source.type,name:source.name,id:source.id,side:source.side,shadowSide:source.shadowSide,
        alphaTest:source.alphaTest,map:!!source.map,alphaMap:!!source.alphaMap,vertexColors:source.vertexColors,
        transparent:source.transparent},
      materialSide:material?.side,
    };
  }
  const methods=[
    'linkProgram','getProgramParameter','getProgramInfoLog','getUniformLocation','getAttribLocation','useProgram',
    'bufferData','bufferSubData','texImage2D','texSubImage2D','texImage3D','texSubImage3D',
    'texStorage2D','texStorage3D','compressedTexImage2D','compressedTexSubImage2D',
    'drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'
  ];
  for(const method of methods){
    const original=gl[method];
    if(typeof original!=='function')continue;
    gl[method]=function(){
      const before=clock();
      try{return original.apply(this,arguments);}
      finally{
        const end=clock(),ms=end-before;
        if(ms>2){
          const object=context?.[4],material=context?.[3],path=[];
          for(let node=object;node&&path.length<8;node=node.parent)if(node.name)path.push(node.name);
          events[eventCount++%2048]={method,start:before,end,ms,stage:inShadow?'shadow':composer?'composer':active?'preparation':'outside-frame',
            object:object?.name||object?.type||null,objectId:object?.id??null,path:path.reverse(),
            material:material?.name||material?.type||null,materialId:material?.id??null,
            shader:programCalls.has(method)?shaderVariant(arguments[0]):undefined};
        }
      }
    };
  }
  const direct=renderer.renderBufferDirect;
  renderer.renderBufferDirect=function(){
    const previous=context;context=arguments;
    try{return direct.apply(this,arguments);}finally{context=previous;}
  };
  const shadow=renderer.shadowMap.render;
  renderer.shadowMap.render=function(){
    const previous=inShadow;inShadow=true;
    const before=clock();
    try{return shadow.apply(this,arguments);}
    finally{if(active&&!previous)shadowMs+=clock()-before;inShadow=previous;}
  };
  return {
    frame(){start=clock();active=true;composer=0;shadowMs=0;},
    composer(){composer=clock();},
    end(){
      const end=clock();
      frames[frameCount++%4096]={start,end,preparationMs:composer-start,shadowMs,composerOtherMs:end-composer-shadowMs};
      active=false;composer=0;
    },
    report(from,to){
      const overlap=row=>row.start<to&&row.end>=from;
      const calls=events.filter(overlap).sort((a,b)=>a.start-b.start);
      const windowFrames=frames.filter(overlap).sort((a,b)=>(b.end-b.start)-(a.end-a.start));
      return {from,to,thresholdMs:2,calls,frameCount:windowFrames.length,slowestFrames:windowFrames.slice(0,12),
        callsTruncated:eventCount>events.length&&events[eventCount%events.length].start>from,
        framesTruncated:frameCount>frames.length&&frames[frameCount%frames.length].start>from};
    }
  };
}
