import {ShaderChunk} from 'three';

export function installDirectionalShadowCutoff() {
  // Physical direct lighting multiplies every lobe by its clamped surface cosine.
  // Clearcoat can face the sun even where the base normal points away.
  const lookup = '( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]';
  ShaderChunk.lights_fragment_begin = ShaderChunk.lights_fragment_begin.replace(lookup, `( directLight.visible && receiveShadow
    #ifdef STANDARD
      && ( dot( geometryNormal, directLight.direction ) > 0.0
        #ifdef USE_CLEARCOAT
          || dot( geometryClearcoatNormal, directLight.direction ) > 0.0
        #endif
      )
    #endif
  ) ? getShadow( directionalShadowMap[ i ]`);
}
