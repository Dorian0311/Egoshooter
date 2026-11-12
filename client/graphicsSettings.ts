export const graphicsPresets = {
  auto: { label: 'Auto · Ziel 60 FPS', pixelRatio: 1.25, shadowSize: 1536, ao: false, bloom: false },
  performance: { label: 'Flüssig', pixelRatio: 1, shadowSize: 1024, ao: false, bloom: false },
  high: { label: 'Hoch', pixelRatio: 1.5, shadowSize: 2048, ao: true, bloom: true },
  ultra: { label: 'Ultra', pixelRatio: 2, shadowSize: 4096, ao: true, bloom: true },
} as const;
export type GraphicsQuality = keyof typeof graphicsPresets;
export const graphicsStorageKey = 'altstadt.graphics.v2';
export function parseGraphicsQuality(value: unknown): GraphicsQuality {
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
  update(dt:number,visible=true){
    if(!visible||!Number.isFinite(dt)||dt<=0||dt>.15){this.elapsed=0;this.frames=0;this.stable=0;return this.scale;}
    if(this.warmup>0){this.warmup-=dt;return this.scale;}
    this.elapsed+=dt;this.frames++;
    if(this.elapsed<2)return this.scale;
    const mean=this.elapsed/this.frames;
    if(mean>1/55){this.scale=Math.max(.55,Math.round((this.scale-.10)*100)/100);this.stable=0;}
    else if(mean<1/59){this.stable+=this.elapsed;if(this.stable>=8){this.scale=Math.min(1,this.scale+.05);this.stable=0;}}
    else this.stable=0;
    this.elapsed=0;this.frames=0;return this.scale;
  }
  reset(){this.scale=1;this.elapsed=0;this.frames=0;this.stable=0;this.warmup=3;}
}
// Bound total pixels as well as DPR: a 4K monitor must not allocate 8K render targets.
export function renderPixelRatio(quality: GraphicsQuality, dpr: number, width: number, height: number) {
  const budget = quality==='auto'?921_600:quality === 'ultra' ? 8_294_400 : quality === 'high' ? 3_686_400 : 2_073_600;
  return Math.min(Math.max(.5, dpr || 1), graphicsPresets[quality].pixelRatio,
    Math.sqrt(budget / Math.max(1, width * height)));
}
