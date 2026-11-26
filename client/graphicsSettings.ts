export const graphicsPresets = {
  auto: { label: 'Auto · Ziel 60 FPS', pixelRatio: 1.25, shadowSize: 1536, shadowExtent:32, antialias:'fxaa', ao: false, bloom: false },
  performance: { label: 'Flüssig', pixelRatio: 1, shadowSize: 1024, shadowExtent:32, antialias:'fxaa', ao: false, bloom: false },
  high: { label: 'Hoch', pixelRatio: 1.5, shadowSize: 2048, shadowExtent:52, antialias:'smaa', ao: true, bloom: false },
  ultra: { label: 'Ultra', pixelRatio: 2, shadowSize: 4096, shadowExtent:52, antialias:'smaa', ao: true, bloom: true },
} as const;
export type GraphicsQuality = keyof typeof graphicsPresets;
// Reset the previous implicit "high" default so existing installations adapt too.
export const graphicsStorageKey = 'altstadt.graphics.v3';
export function parseGraphicsQuality(value: unknown): GraphicsQuality {
  if(value===null)return 'auto';
  return value === 'performance' || value === 'high' || value === 'ultra' || value==='auto' ? value : 'auto';
}

// Slow frames lower resolution quickly; recovering quality needs sustained headroom.
// Long pauses/loading stalls never become evidence about steady rendering performance.
export class ResolutionGovernor {
  scale=1;
  private elapsed=0;
  private frames=0;
  private stable=0;
  private warmup=3;
  private gpuTotal=0;
  private gpuFrames=0;
  private cpuTotal=0;
  private cpuFrames=0;
  private recoveryDelay=0;
  private clearWindow(){this.elapsed=0;this.frames=0;this.gpuTotal=0;this.gpuFrames=0;this.cpuTotal=0;this.cpuFrames=0;}
  update(dt:number,visible=true,gpuMs?:number,cpuMs?:number){
    if(!visible||!Number.isFinite(dt)||dt<=0||dt>.15){this.clearWindow();this.stable=0;return this.scale;}
    if(this.warmup>0){this.warmup-=dt;return this.scale;}
    this.recoveryDelay=Math.max(0,this.recoveryDelay-dt);
    this.elapsed+=dt;this.frames++;
    if(gpuMs!==undefined&&Number.isFinite(gpuMs)&&gpuMs>0){this.gpuTotal+=gpuMs;this.gpuFrames++;}
    if(cpuMs!==undefined&&Number.isFinite(cpuMs)&&cpuMs>=0){this.cpuTotal+=cpuMs;this.cpuFrames++;}
    if(this.elapsed<2)return this.scale;
    const mean=this.elapsed/this.frames;
    const gpu=this.gpuFrames?this.gpuTotal/this.gpuFrames:undefined,cpu=this.cpuFrames?this.cpuTotal/this.cpuFrames:undefined;
    // Leave headroom for 60 Hz presentation instead of settling at 55–57 FPS.
    if(mean>1/58){
      // Lowering resolution cannot fix CPU/scheduling stalls with an idle GPU.
      const cpuLimited=cpu!==undefined&&cpu>=1000/60&&gpu!==undefined&&gpu<15;
      if(!cpuLimited&&(gpu===undefined||gpu>12)){const next=Math.max(.55,Math.round((this.scale-.10)*100)/100);if(next<this.scale)this.recoveryDelay=6;this.scale=next;}
      this.stable=0;
    }
    else if(mean<1/59&&this.recoveryDelay===0&&(gpu===undefined||gpu<11.5)&&(cpu===undefined||cpu<12)){
      this.stable+=this.elapsed;if(this.stable>=8){this.scale=Math.min(1,Math.round((this.scale+.05)*100)/100);this.stable=0;}
    }
    else this.stable=0;
    this.clearWindow();return this.scale;
  }
  reset(initialScale=1){this.scale=initialScale;this.clearWindow();this.stable=0;this.warmup=3;this.recoveryDelay=0;}
}
// Bound total pixels as well as DPR: a 4K monitor must not allocate 8K render targets.
export function renderPixelRatio(quality: GraphicsQuality, dpr: number, width: number, height: number) {
  const budget = quality==='auto'?1_440_000:quality === 'ultra' ? 8_294_400 : quality === 'high' ? 3_686_400 : 2_073_600;
  return Math.min(Math.max(.5, dpr || 1), graphicsPresets[quality].pixelRatio,
    Math.sqrt(budget / Math.max(1, width * height)));
}

export function initialResolutionScale(quality: GraphicsQuality, baseRatio: number, width: number, height: number) {
  const budget = quality==='auto'?921_600:quality==='performance'?1_440_000:undefined;
  return budget === undefined ? 1 : Math.min(1, Math.sqrt(budget / Math.max(1, width * height)) / baseRatio);
}
