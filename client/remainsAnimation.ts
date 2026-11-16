import * as T from 'three';
/** Reach, braced pull, alternating twist and final release use the same server clock. */
export function harvestAnimation(progress:number){const p=T.MathUtils.clamp(progress,0,1),reach=T.MathUtils.smoothstep(p,0,.22),pull=T.MathUtils.smoothstep(p,.24,.87),twist=Math.sin(T.MathUtils.smoothstep(p,.35,.90)*Math.PI*3)*Math.sin(p*Math.PI);return {reach,pull,twist,jolt:Math.max(0,1-Math.abs(p-.91)/.09)};}
