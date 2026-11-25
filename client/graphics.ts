import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {fxaaOutputShader} from './fxaaOutput';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { graphicsPresets, renderPixelRatio, ResolutionGovernor, type GraphicsQuality } from './graphicsSettings.ts';
import {createWeaponScene} from './weaponScene';
import {createGpuTiming} from './gpuTiming';
import {ShadowCadence} from './shadowCadence';

// Keep the environment's lighting while preventing its sky from covering the
// world during the second, depth-cleared first-person render.
class WeaponPass extends RenderPass {
  override render(...args:Parameters<RenderPass['render']>){
    const background=this.scene.background;
    this.scene.background=null;
    try{super.render(...args);}finally{this.scene.background=background;}
  }
}

export function createGraphics(renderer: T.WebGLRenderer, scene: T.Scene,
  camera: T.PerspectiveCamera, sun: T.DirectionalLight, initialQuality: GraphicsQuality) {
  const composer = new EffectComposer(renderer);
  renderer.info.autoReset = false;
  // RenderPass updates shadows once; the following SSAO normal pass reuses them.
  renderer.shadowMap.autoUpdate = false;
  const render = new RenderPass(scene, camera);
  const weaponCamera=new T.PerspectiveCamera(62,1,.025,8);
  weaponCamera.layers.set(1);
  const viewmodel=createWeaponScene(scene,camera,weaponCamera);
  const weaponPass=new WeaponPass(viewmodel.scene,weaponCamera);
  weaponPass.clear=false;weaponPass.clearDepth=true;
  const ao = new SSAOPass(scene, camera, 1, 1, 24);
  ao.kernelRadius = .65;
  ao.minDistance = .001;
  ao.maxDistance = .025;
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .075, .3, 1.65);
  const smaa = new SMAAPass(1, 1);
  const fxaa=new ShaderPass(fxaaOutputShader);fxaa.material.toneMapped=true;
  fxaa.setSize=(w:number,h:number)=>{fxaa.uniforms.resolution.value.set(1/Math.max(1,w),1/Math.max(1,h));};
  const output = new OutputPass();
  // Stay in linear HDR until OutputPass performs the single tone/color conversion.
  for (const pass of [render, ao, weaponPass, bloom, fxaa, smaa, output]) composer.addPass(pass);
  let quality = initialQuality, width = 0, height = 0, ratio = 0;
  let resolutionScaling=true;
  // Contact shading is low-frequency; its normal/depth buffers need fewer pixels
  // than the crisp full-resolution color/SMAA buffers.
  const resizeOcclusion = ao.setSize.bind(ao);
  ao.setSize = (w: number, h: number) => {
    const scale = quality === 'ultra' ? .75 : .5;
    resizeOcclusion(Math.max(1, Math.floor(w * scale)), Math.max(1, Math.floor(h * scale)));
  };
  let shadowExtent = 52;
  const sunOffset = new T.Vector3(-70, 80, 55);
  const lightRotation = new T.Matrix4().lookAt(sunOffset, new T.Vector3(), T.Object3D.DEFAULT_UP);
  const inverseRotation = lightRotation.clone().invert();
  const shadowCenter = new T.Vector3();
  const governor=new ResolutionGovernor();
  const gpuTiming=createGpuTiming(renderer.getContext() as WebGL2RenderingContext);
  const shadowCadence=new ShadowCadence();let timingFrame=0,timingEnabled=true;
  let frameCpuAverage=0;
  const frameState={shadowUpdated:false,resized:false,pixelRatio:0,gpuMs:undefined as number|undefined};
  scene.add(sun.target);
  Object.assign(sun.shadow.camera, {
    left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent,
    near: 1, far: 300,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00008;
  sun.shadow.normalBias = .035;

  function setQuality(value: GraphicsQuality) {
    quality = value;
    governor.reset();gpuTiming.reset();timingFrame=0;shadowCadence.reset();frameCpuAverage=0;
    const preset = graphicsPresets[quality];
    // Spend the automatic/performance shadow budget near the player. Spatial
    // world batches let the smaller light frustum actually reject distant work.
    shadowExtent=preset.shadowExtent;
    Object.assign(sun.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent});
    sun.shadow.camera.updateProjectionMatrix();
    const shadowSize = Math.min(preset.shadowSize, renderer.capabilities.maxTextureSize);
    if (sun.shadow.mapSize.x !== shadowSize) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
    }
    ao.enabled = preset.ao;
    bloom.enabled = preset.bloom;
    fxaa.enabled=preset.antialias==='fxaa';smaa.enabled=preset.antialias==='smaa';
    output.enabled=!fxaa.enabled;
    ratio = 0;
  }
  setQuality(quality);
  function warmup(object:T.Object3D,weapon=false){
    if(weapon)viewmodel.sync();
    // Three chooses shader variants from the bound render target. Compile in
    // the same linear HDR target used by the world and viewmodel passes.
    const previous=renderer.getRenderTarget();
    renderer.setRenderTarget(composer.readBuffer);
    try{return renderer.compileAsync(object,weapon?weaponCamera:camera,weapon?viewmodel.scene:scene);}
    finally{renderer.setRenderTarget(previous);}
  }
  function warmupWorldDraw(){
    // compileAsync links colour programs. A tiny off-screen draw also
    // initializes vertex buffers, texture bindings and shadow depth programs.
    const target=composer.readBuffer,previous=renderer.getRenderTarget();
    const scissor=target.scissor.clone(),scissorTest=target.scissorTest;
    const shadowUpdate=renderer.shadowMap.needsUpdate;
    const uncull:T.Object3D[]=[];
    scene.traverseVisible(object=>{
      if(object instanceof T.Mesh&&object.frustumCulled){uncull.push(object);object.frustumCulled=false;}
    });
    try{
      target.scissor.set(0,0,1,1);target.scissorTest=true;
      renderer.setRenderTarget(target);
      renderer.shadowMap.needsUpdate=true;
      renderer.render(scene,camera);
    }finally{
      for(const object of uncull)object.frustumCulled=true;
      target.scissor.copy(scissor);target.scissorTest=scissorTest;
      renderer.setRenderTarget(previous);
      renderer.shadowMap.needsUpdate=shadowUpdate;
    }
  }
  return {
    setQuality,
    setResolutionScaling(value:boolean){resolutionScaling=value;governor.reset();},
    setTimingEnabled(value:boolean){timingEnabled=value;gpuTiming.reset();timingFrame=0;},
    frameState,
    warmup,warmupWorldDraw,
    weaponFov:()=>weaponCamera.fov,
    stats:()=>({quality,antialias:fxaa.enabled?'fxaa':'smaa',aaPasses:Number(fxaa.enabled)+Number(smaa.enabled),scale:ratio/Math.max(.01,renderPixelRatio(quality,window.devicePixelRatio,width,height)),pixelRatio:ratio,gpuMs:gpuTiming.state.ms}),
    render(dt: number,aimBlend=0,adaptive=true,cpuMs?:number,frameSeconds=dt,viewport?:{width:number;height:number},weaponVisible=true) {
      const w = Math.max(1, viewport?.width??renderer.domElement.clientWidth);
      const h = Math.max(1, viewport?.height??renderer.domElement.clientHeight);
      // A few asynchronous samples/second are enough for the quality governor;
      // avoid querying the driver on every rendered frame.
      const currentTimingFrame=timingFrame++;
      if(timingEnabled&&currentTimingFrame%4===0)gpuTiming.poll();
      frameState.gpuMs=gpuTiming.state.ms;
      const scale=quality==='auto'&&resolutionScaling?governor.update(frameSeconds,!document.hidden&&adaptive,gpuTiming.state.ms,cpuMs):1;
      const baseRatio=renderPixelRatio(quality, window.devicePixelRatio, w, h);
      // Keep the image legible without cancelling adaptive scaling in
      // smaller windows. The HUD is still drawn at native resolution.
      const nextRatio = Math.max(Math.min(baseRatio*.8,540/h),baseRatio*scale);
      frameState.resized=w!==width||h!==height||ratio!==nextRatio;frameState.pixelRatio=nextRatio;
      if (w !== width || h !== height || ratio !== nextRatio) {
        const resized=w!==width||h!==height,ratioChanged=ratio!==nextRatio;
        width = w; height = h; ratio = nextRatio;
        renderer.setDrawingBufferSize(w,h,ratio);
        if(ratioChanged)composer.setPixelRatio(ratio);
        if(resized)composer.setSize(w,h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      // Snap in LIGHT space, not world space, so shadows remain stable while moving.
      if(cpuMs!==undefined&&Number.isFinite(cpuMs))frameCpuAverage+=(Math.min(50,cpuMs)-frameCpuAverage)*.1;
      const updateShadow=shadowCadence.update(dt,quality,quality==='auto'&&(scale<=.9||frameCpuAverage>13));
      frameState.shadowUpdated=updateShadow;
      if(updateShadow){
        const texel = shadowExtent * 2 / sun.shadow.mapSize.x;
        shadowCenter.copy(camera.position).applyMatrix4(inverseRotation);
        shadowCenter.x = Math.round(shadowCenter.x / texel) * texel;
        shadowCenter.y = Math.round(shadowCenter.y / texel) * texel;
        shadowCenter.applyMatrix4(lightRotation);
        sun.target.position.copy(shadowCenter);
        sun.position.copy(shadowCenter).add(sunOffset);
        sun.target.updateMatrixWorld();
      }
      renderer.info.reset();
      renderer.shadowMap.needsUpdate = updateShadow;
      weaponPass.enabled=weaponVisible;
      const fov=62-12*aimBlend;
      if(weaponCamera.aspect!==camera.aspect||weaponCamera.fov!==fov){
        weaponCamera.aspect=camera.aspect;weaponCamera.fov=fov;weaponCamera.updateProjectionMatrix();
      }
      if(weaponVisible){
        camera.updateWorldMatrix(true,false);
        camera.matrixWorld.decompose(weaponCamera.position,weaponCamera.quaternion,weaponCamera.scale);
        weaponCamera.updateMatrixWorld();
        viewmodel.sync();
      }
      if(timingEnabled&&quality==='auto'&&adaptive&&currentTimingFrame%17===0)gpuTiming.begin();
      try{composer.render(dt);}finally{gpuTiming.end();}
    },
    dispose() {
      for (const pass of [render, ao, weaponPass, bloom, fxaa, smaa, output]) pass.dispose();
      // r170's SSAOPass.dispose omits these owned GPU resources.
      ao.noiseTexture.dispose();
      ao.ssaoMaterial.dispose();
      composer.dispose();
      gpuTiming.dispose();
      viewmodel.dispose();
      sun.shadow.dispose();
      scene.remove(sun.target);
    },
  };
}
