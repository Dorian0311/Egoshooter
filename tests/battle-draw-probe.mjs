// Optional diagnostic on the isolated release build. CPU wall time includes driver stalls.
export function attachBattleDrawProbe(renderer) {
  const gl=renderer.getContext();
  const draw=renderer.renderBufferDirect;
  const use=gl.useProgram;
  let frameProfile, samples=[], bucket;
  gl.useProgram=function(program) {
    if(bucket) bucket.programBinds++;
    return use.call(this,program);
  };
  renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group) {
    if(!frameProfile) return draw.call(this,camera,scene,geometry,material,object,group);
    const sample=samples[frameProfile.length]??=Object.create(null);
    const phase=material.isMeshDepthMaterial||material.isMeshDistanceMaterial?'depth':
      material.isMeshNormalMaterial?'normal':material.isShaderMaterial?'shader':'surface';
    const shape=object.isSkinnedMesh?'skinned':object.isInstancedMesh?'instanced':'mesh';
    const key=phase+'/'+shape+'/'+(material.name||material.type);
    const row=sample[key]??={calls:0,wallMs:0,programBinds:0};
    const outer=bucket;
    bucket=row;
    const start=performance.now();
    try { return draw.call(this,camera,scene,geometry,material,object,group); }
    finally { row.wallMs+=performance.now()-start; row.calls++; bucket=outer; }
  };
  return {
    start(frames) { frameProfile=frames; samples=[]; },
    finish(ranges) {
      const frames=frameProfile;
      frameProfile=undefined;
      const ids=[];
      for(const [first,end] of ranges)
        for(let i=Math.max(first,1);i<end;i++) ids.push(i-1);
      const rows=Object.create(null);
      for(const id of ids) for(const [key,value] of Object.entries(samples[id]??{})) {
        const total=rows[key]??={calls:0,wallMs:0,programBinds:0};
        total.calls+=value.calls; total.wallMs+=value.wallMs; total.programBinds+=value.programBinds;
      }
      const ranked=values=>Object.entries(values).sort((a,b)=>b[1].wallMs-a[1].wallMs);
      const worst=ids.sort((a,b)=>frames[b+1].frameMs-frames[a+1].frameMs||frames[b].cpuMs-frames[a].cpuMs).slice(0,3);
      return {frames:ids.length,bySubmissionTime:ranked(rows).slice(0,12),
        worstIntervals:worst.map(i=>({nextFrameMs:frames[i+1].frameMs,cpuMs:frames[i].cpuMs,
          calls:frames[i].calls,topSubmissions:ranked(samples[i]??{}).slice(0,5)}))};
    }
  };
}
