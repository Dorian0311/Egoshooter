// Optional diagnostic on the isolated release build. CPU wall time includes driver stalls.
export function attachBattleDrawProbe(renderer) {
  const gl=renderer.getContext();
  const draw=renderer.renderBufferDirect;
  const use=gl.useProgram;
  let frameProfile, samples=[], switches=[], bucket, lastProgram=null;
  const idsByProgram=new Map(),programsById=[null],descriptions=new Map();
  function programId(program) {
    if(!program) return 0;
    if(!idsByProgram.has(program)) {
      idsByProgram.set(program,programsById.length);
      programsById.push(program);
    }
    return idsByProgram.get(program);
  }
  function describeProgram(id) {
    if(!descriptions.has(id)) {
      const program=programsById[id];
      const defines=new Set();
      if(program && gl.isProgram(program)) {
        for(const shader of gl.getAttachedShaders(program)??[]) {
          const source=gl.getShaderSource(shader)??'';
          for(const match of source.matchAll(/^\s*#define\s+((?:USE_\w+|NUM_\w+|SHADER_NAME|DOUBLE_SIDED|FLIP_SIDED)(?:[ \t]+[^\n\r]+)?)/gm)) defines.add(match[1].trim());
        }
      }
      descriptions.set(id,[...defines].sort());
    }
    return descriptions.get(id);
  }
  gl.useProgram=function(program) {
    if(bucket) {
      bucket.programBinds++;
      const pair=programId(lastProgram)+'>'+programId(program);
      const counts=switches[frameProfile.length]??=Object.create(null);
      counts[pair]=(counts[pair]??0)+1;
    }
    lastProgram=program;
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
    start(frames) { frameProfile=frames; samples=[]; switches=[]; },
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
      const totals={};
      for(const id of ids) for(const [pair,count] of Object.entries(switches[id]??{}))
        totals[pair]=(totals[pair]??0)+count;
      // Query driver shader sources only after the measured turns have finished.
      const programTransitions=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([pair,count])=>{
        const [from,to]=pair.split('>').map(Number);
        const a=describeProgram(from),b=describeProgram(to);
        return {from,to,count,fromName:a.find(d=>d.startsWith('SHADER_NAME ')),
          toName:b.find(d=>d.startsWith('SHADER_NAME ')),
          removed:a.filter(d=>!b.includes(d)),added:b.filter(d=>!a.includes(d))};
      });
      const worst=ids.sort((a,b)=>frames[b+1].frameMs-frames[a+1].frameMs||frames[b].cpuMs-frames[a].cpuMs).slice(0,3);
      return {frames:ids.length,bySubmissionTime:ranked(rows).slice(0,12),programTransitions,
        worstIntervals:worst.map(i=>({nextFrameMs:frames[i+1].frameMs,cpuMs:frames[i].cpuMs,
          calls:frames[i].calls,topSubmissions:ranked(samples[i]??{}).slice(0,5)}))};
    }
  };
}
