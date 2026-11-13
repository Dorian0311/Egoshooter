import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { graphicsPresets, renderPixelRatio, ResolutionGovernor, type GraphicsQuality } from './graphicsSettings.ts';

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
  const weaponPass=new WeaponPass(scene,weaponCamera);
  weaponPass.clear=false;weaponPass.clearDepth=true;
  const ao = new SSAOPass(scene, camera, 1, 1, 24);
  ao.kernelRadius = .65;
  ao.minDistance = .001;
  ao.maxDistance = .025;
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .075, .3, 1.65);
  const smaa = new SMAAPass(1, 1);
  const output = new OutputPass();
  // Stay in linear HDR until OutputPass performs the single tone/color conversion.
  for (const pass of [render, ao, weaponPass, bloom, smaa, output]) composer.addPass(pass);
  let quality = initialQuality, width = 0, height = 0, ratio = 0;
  // Contact shading is low-frequency; its normal/depth buffers need fewer pixels
  // than the crisp full-resolution color/SMAA buffers.
  const resizeOcclusion = ao.setSize.bind(ao);
  ao.setSize = (w: number, h: number) => {
    const scale = quality === 'ultra' ? .75 : .5;
    resizeOcclusion(Math.max(1, Math.floor(w * scale)), Math.max(1, Math.floor(h * scale)));
  };
  const shadowExtent = 52;
  const sunOffset = new T.Vector3(-70, 80, 55);
  const lightRotation = new T.Matrix4().lookAt(sunOffset, new T.Vector3(), T.Object3D.DEFAULT_UP);
  const inverseRotation = lightRotation.clone().invert();
  const shadowCenter = new T.Vector3();
  const governor=new ResolutionGovernor();
  let shadowElapsed=1;
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
    governor.reset();shadowElapsed=1;
    const preset = graphicsPresets[quality];
    const shadowSize = Math.min(preset.shadowSize, renderer.capabilities.maxTextureSize);
    if (sun.shadow.mapSize.x !== shadowSize) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
    }
    ao.enabled = preset.ao;
    bloom.enabled = preset.bloom;
    ratio = 0;
  }
  setQuality(quality);
  return {
    setQuality,
    weaponFov:()=>weaponCamera.fov,
    stats:()=>({quality,scale:ratio/Math.max(.01,renderPixelRatio(quality,window.devicePixelRatio,width,height)),pixelRatio:ratio}),
    render(dt: number,aimBlend=0,adaptive=true) {
      const w = Math.max(1, renderer.domElement.clientWidth);
      const h = Math.max(1, renderer.domElement.clientHeight);
      const scale=quality==='auto'?governor.update(dt,!document.hidden&&adaptive):1;
      const baseRatio=renderPixelRatio(quality, window.devicePixelRatio, w, h);
      // Keep the 3D image at least 540 pixels tall when the viewport permits it.
      const nextRatio = Math.max(Math.min(baseRatio,540/h),baseRatio*scale);
      if (w !== width || h !== height || ratio !== nextRatio) {
        width = w; height = h; ratio = nextRatio;
        renderer.setPixelRatio(ratio);
        renderer.setSize(w, h, false);
        composer.setPixelRatio(ratio);
        composer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      // Snap in LIGHT space, not world space, so shadows remain stable while moving.
      shadowElapsed+=dt;
      const updateShadow=quality!=='auto'||shadowElapsed>=1/30;
      if(updateShadow){
        const texel = shadowExtent * 2 / sun.shadow.mapSize.x;
        shadowCenter.copy(camera.position).applyMatrix4(inverseRotation);
        shadowCenter.x = Math.round(shadowCenter.x / texel) * texel;
        shadowCenter.y = Math.round(shadowCenter.y / texel) * texel;
        shadowCenter.applyMatrix4(lightRotation);
        sun.target.position.copy(shadowCenter);
        sun.position.copy(shadowCenter).add(sunOffset);
        sun.target.updateMatrixWorld();shadowElapsed=0;
      }
      renderer.info.reset();
      renderer.shadowMap.needsUpdate = updateShadow;
      camera.updateWorldMatrix(true,false);
      camera.matrixWorld.decompose(weaponCamera.position,weaponCamera.quaternion,weaponCamera.scale);
      weaponCamera.aspect=camera.aspect;weaponCamera.fov=62-12*aimBlend;
      weaponCamera.updateProjectionMatrix();weaponCamera.updateMatrixWorld();
      composer.render(dt);
    },
    dispose() {
      for (const pass of [render, ao, weaponPass, bloom, smaa, output]) pass.dispose();
      // r170's SSAOPass.dispose omits these owned GPU resources.
      ao.noiseTexture.dispose();
      ao.ssaoMaterial.dispose();
      composer.dispose();
      sun.shadow.dispose();
      scene.remove(sun.target);
    },
  };
}
