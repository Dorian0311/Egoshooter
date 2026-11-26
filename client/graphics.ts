import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import {WorldRenderPass} from './worldRenderPass';
import { WorldOcclusionPass } from './worldOcclusionPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import {skipRedundantSmaaClears} from './smaaClears';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {fxaaOutputShader} from './fxaaOutput';
import { graphicsPresets, renderPixelRatio, ResolutionGovernor, type GraphicsQuality } from './graphicsSettings.ts';
import {createWeaponScene} from './weaponScene';
import {createGpuTiming} from './gpuTiming';
import {withBodyDistanceUpload} from './actorDetails';
import {ShadowCadence} from './shadowCadence';
import {createReceiverShadowFrustum,setReceiverShadowScissor} from './receiverShadowFrustum';

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
  const render = new WorldRenderPass(scene, camera);
  const weaponCamera=new T.PerspectiveCamera(62,1,.025,8);
  weaponCamera.layers.set(1);
  const viewmodel=createWeaponScene(scene,camera,weaponCamera);
  const weaponPass=new WeaponPass(viewmodel.scene,weaponCamera);
  weaponPass.clear=false;weaponPass.clearDepth=true;
  const ao = new WorldOcclusionPass(scene, camera, 1, 1, 24);
  ao.kernelRadius = .65;
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .075, .3, 1.65);
  const smaa = new SMAAPass(1, 1);
  skipRedundantSmaaClears(smaa);
  // SMAA reads only red and green edge flags. RG16F preserves their filtered values.
  smaa.edgesRT.texture.format = T.RGFormat;
  const blendOutput='gl_FragColor = SMAANeighborhoodBlendingPS( vUv, vOffset, tColor, tDiffuse );';
  // Keep the old half-float write precision before converting HDR to display color.
  smaa.materialBlend.fragmentShader=smaa.materialBlend.fragmentShader.replace(blendOutput,`${blendOutput}
   gl_FragColor = vec4(unpackHalf2x16(packHalf2x16(gl_FragColor.rg)), unpackHalf2x16(packHalf2x16(gl_FragColor.ba)));
   #include <tonemapping_fragment>
   #include <colorspace_fragment>`);
  smaa.materialBlend.toneMapped=true;
  const fxaa=new ShaderPass(fxaaOutputShader);fxaa.material.toneMapped=true;
  // Both AA passes write directly to the screen. Swapping here makes the next
  // world frame allocate a second full-size HDR target and depth attachment.
  fxaa.needsSwap=false;
  smaa.needsSwap=false;
  fxaa.setSize=(w:number,h:number)=>{fxaa.uniforms.resolution.value.set(1/Math.max(1,w),1/Math.max(1,h));};
  const pipeline=[render,ao,weaponPass,bloom,fxaa,smaa];
  // The composer receives physical pixels; changing viewport and DPR together must resize its targets only once.
  composer.setPixelRatio(1);
  let quality = initialQuality, width = 0, height = 0, ratio = 0;
  let resolutionScaling=true,resetScale=true;
  // Contact shading is low-frequency; its normal/depth buffers need fewer pixels
  // than the crisp full-resolution color/SMAA buffers.
  const resizeOcclusion = ao.setSize.bind(ao);
  ao.setSize = (w: number, h: number) => {
    const scale = quality === 'ultra' ? .75 : .5;
    resizeOcclusion(Math.max(1, Math.floor(w * scale)), Math.max(1, Math.floor(h * scale)));
  };
  let shadowExtent = 52;
  const sunOffset = sun.position.clone().sub(sun.target.position);
  const lightRotation = new T.Matrix4().lookAt(sunOffset, new T.Vector3(), T.Object3D.DEFAULT_UP);
  const inverseRotation = lightRotation.clone().invert();
  const shadowCenter = new T.Vector3();
  const governor=new ResolutionGovernor();
  const gpuTiming=createGpuTiming(renderer.getContext() as WebGL2RenderingContext);
  const shadowCadence=new ShadowCadence();let timingFrame=0,timingEnabled=true;
  const receiverFrustum=createReceiverShadowFrustum(),lightFrustum=sun.shadow.getFrustum;
  let clippedShadow:T.Frustum|undefined;
  const savedShadowScissor=new T.Vector4();
  sun.shadow.getFrustum=()=>clippedShadow??lightFrustum.call(sun.shadow);
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
    resetScale=true;gpuTiming.reset();timingFrame=0;shadowCadence.reset();frameCpuAverage=0;
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
    // EffectComposer.setSize also touches disabled passes. Only the active preset owns full-size buffers.
    for(const pass of composer.passes){
      if(pass!==weaponPass&&!pass.enabled)pass.setSize(1,1);
    }
    composer.passes=pipeline.filter(pass=>pass===weaponPass||pass.enabled);
    ratio=0;

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
  const warmedShadowSources=new Set<string>();
  function warmupWorldDraw(actorRoots:readonly T.Group[]=[],actorsOnly=false){
    // compileAsync links colour programs. A tiny off-screen draw also
    // initializes vertex buffers, texture bindings and shadow depth programs.
    const target=composer.readBuffer,previous=renderer.getRenderTarget();
    const scissor=target.scissor.clone(),scissorTest=target.scissorTest;
    const shadowUpdate=renderer.shadowMap.needsUpdate;
    const uncull:T.Object3D[]=[],hidden:T.Object3D[]=[],extraLayer:T.Object3D[]=[];
    const cameraLayers=camera.layers.mask,uploadLayer=30;
    function enableUpload(object:T.Object3D){
      if(object.layers.test(camera.layers)&&!object.layers.isEnabled(uploadLayer)){
        object.layers.enable(uploadLayer);extraLayer.push(object);
      }
    }
    try{
      // The first spawn camera can face away from completed avatars. Upload their real skinned buffers now.
      for(const actor of actorRoots){
        for(const root of [actor.parent,actor])if(root&&!root.visible){root.visible=true;hidden.push(root);}
      }
      target.scissor.set(0,0,1,1);target.scissorTest=true;
      renderer.setRenderTarget(target);
      // These shadow casters may arrive after the first shadow map or start outside its frustum.
      // Exercise one real mesh of each kind without unculling the entire map's shadows.
      const sources=[
        ['cover-crate-shadow-hulls','isInstancedMesh'],
        ['civilian-rocketbox-male-adult-03','isSkinnedMesh'],
        ['world-kar98k','isMesh'],
      ] as const;
      const prepared:string[]=[];
      const restoreDepth:(()=>void)[]=[];
      try{
        for(const [name,property] of sources){
          if(warmedShadowSources.has(name))continue;
          const caster=scene.getObjectByName(name)?.getObjectByProperty(property,true);
          if(!(caster instanceof T.Mesh))continue;
          const culled=caster.frustumCulled,cast=caster.castShadow,mask=caster.layers.mask;
          restoreDepth.push(()=>{caster.frustumCulled=culled;caster.castShadow=cast;caster.layers.mask=mask;});
          caster.frustumCulled=false;caster.castShadow=true;caster.layers.mask|=camera.layers.mask;
          for(let node:T.Object3D|null=caster;node;node=node.parent){
            if(!node.visible){const hiddenNode=node;node.visible=true;restoreDepth.push(()=>{hiddenNode.visible=false;});}
          }
          prepared.push(name);
        }
        if(prepared.length||(!actorsOnly&&!sun.shadow.map)){
          renderer.shadowMap.needsUpdate=true;
          renderer.render(scene,camera);
          prepared.forEach(name=>warmedShadowSources.add(name));
        }
      }finally{for(const restore of restoreDepth)restore();}
      withBodyDistanceUpload(actorRoots,()=>{
        if(actorsOnly){
          for(const actor of actorRoots)actor.traverseVisible(enableUpload);
          scene.traverseVisible(object=>{if(object instanceof T.Light)enableUpload(object);});
          camera.layers.set(uploadLayer);
        }
        scene.traverseVisible(object=>{
          if(object instanceof T.Mesh&&object.layers.test(camera.layers)&&object.frustumCulled){uncull.push(object);object.frustumCulled=false;}
        });
        renderer.shadowMap.needsUpdate=false;
        renderer.render(scene,camera);
      });
    }finally{
      camera.layers.mask=cameraLayers;
      for(const object of extraLayer)object.layers.disable(uploadLayer);
      for(const object of hidden)object.visible=false;
      for(const object of uncull)object.frustumCulled=true;
      target.scissor.copy(scissor);target.scissorTest=scissorTest;
      renderer.setRenderTarget(previous);
      renderer.shadowMap.needsUpdate=shadowUpdate;
    }
  }
  return {
    setQuality,
    setResolutionScaling(value:boolean){resolutionScaling=value;resetScale=true;},
    setTimingEnabled(value:boolean){timingEnabled=value;gpuTiming.reset();timingFrame=0;},
    frameState,
    warmup,warmupWorldDraw,
    weaponFov:()=>weaponCamera.fov,
    stats:()=>({quality,antialias:fxaa.enabled?'fxaa':'smaa',aaPasses:Number(fxaa.enabled)+Number(smaa.enabled),scale:ratio/Math.max(.01,renderPixelRatio(quality,window.devicePixelRatio,width,height)),pixelRatio:ratio,gpuMs:gpuTiming.state.ms}),
    render(dt: number,aimBlend=0,adaptive=true,cpuMs?:number,frameSeconds=dt,viewport?:{width:number;height:number},weaponVisible=true,occlusionFar=camera.far,skyOccluded=false) {
      const w = Math.max(1, viewport?.width??renderer.domElement.clientWidth);
      const h = Math.max(1, viewport?.height??renderer.domElement.clientHeight);
      // A few asynchronous samples/second are enough for the quality governor;
      // avoid querying the driver on every rendered frame.
      const currentTimingFrame=timingFrame++;
      if(timingEnabled&&currentTimingFrame%4===0)gpuTiming.poll();
      frameState.gpuMs=gpuTiming.state.ms;
      const adaptiveQuality=quality==='auto'||quality==='performance';
      const baseRatio=renderPixelRatio(quality,window.devicePixelRatio,w,h);
      if(resetScale||w!==width||h!==height){
        // Start live performance mode at a 900p pixel budget. Headroom measured by the governor restores full detail.
        const initialScale=quality==='performance'?Math.min(1,Math.sqrt(1_440_000/(w*h))/baseRatio):1;
        governor.reset(initialScale);resetScale=false;
      }
      const scale=adaptiveQuality&&resolutionScaling?governor.update(frameSeconds,!document.hidden&&adaptive,gpuTiming.state.ms,cpuMs):1;
      // Keep the image legible without cancelling adaptive scaling in
      // smaller windows. The HUD is still drawn at native resolution.
      const nextRatio = Math.max(Math.min(baseRatio*.8,540/h),baseRatio*scale);
      frameState.resized=w!==width||h!==height||ratio!==nextRatio;frameState.pixelRatio=nextRatio;
      if (w !== width || h !== height || ratio !== nextRatio) {
        width=w;height=h;ratio=nextRatio;
        renderer.setDrawingBufferSize(w,h,ratio);
        camera.aspect=w/h;
        camera.updateProjectionMatrix();
        composer.setSize(renderer.domElement.width,renderer.domElement.height);
      }
      if(ao.enabled){
        // SSAOPass r170 caches projection on resize; scoped FOV and indoor far clipping change it independently.
        const uniforms=ao.ssaoMaterial.uniforms;
        if(!uniforms.cameraProjectionMatrix.value.equals(camera.projectionMatrix)){
          uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
          uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
        }
        uniforms.cameraNear.value=ao.depthRenderMaterial.uniforms.cameraNear.value=camera.near;
        uniforms.cameraFar.value=ao.depthRenderMaterial.uniforms.cameraFar.value=camera.far;
        // SSAO compares normalized depth intervals. Keep the old world-space
        // distances when a closed interior shortens the perspective frustum.
        const depthScale=(occlusionFar-camera.near)/(camera.far-camera.near);
        ao.minDistance=.001*depthScale;
        ao.maxDistance=.025*depthScale;
      }
      // Snap in LIGHT space, not world space, so shadows remain stable while moving.
      if(cpuMs!==undefined&&Number.isFinite(cpuMs))frameCpuAverage+=(Math.min(50,cpuMs)-frameCpuAverage)*.1;
      const updateShadow=shadowCadence.update(dt,quality,quality==='performance'||quality==='auto'&&(scale<=.9||frameCpuAverage>13));
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
      if(timingEnabled&&adaptiveQuality&&adaptive&&currentTimingFrame%17===0)gpuTiming.begin();
      // These presets refresh the map on every frame, including the first view back outside.
      let restrictedTarget:T.WebGLRenderTarget|undefined;
      if((quality==='high'||quality==='ultra')&&camera.far<shadowExtent){
        sun.updateWorldMatrix(true,false);
        sun.shadow.updateMatrices(sun);
        const full=lightFrustum.call(sun.shadow);
        // Cover biased receiver positions and every PCFSoft tap before restricting writes.
        const padding=Math.abs(sun.shadow.normalBias)+3*shadowExtent*2/sun.shadow.mapSize.x;
        clippedShadow=receiverFrustum(full,camera,weaponVisible?weaponCamera:undefined,padding);
        const target=sun.shadow.map;
        if(target&&!target.scissorTest){
          savedShadowScissor.copy(target.scissor);
          setReceiverShadowScissor(target.scissor,full,clippedShadow,target.width,target.height,shadowExtent*2);
          target.scissorTest=true;
          restrictedTarget=target;
        }
      }
      const sky=scene.background;
      if(skyOccluded)scene.background=null;
      try{composer.render(dt);}finally{
        if(skyOccluded)scene.background=sky;
        if(restrictedTarget){restrictedTarget.scissor.copy(savedShadowScissor);restrictedTarget.scissorTest=false;}
        clippedShadow=undefined;gpuTiming.end();
      }
    },
    dispose() {
      sun.shadow.getFrustum=lightFrustum;
      for (const pass of pipeline) pass.dispose();
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
