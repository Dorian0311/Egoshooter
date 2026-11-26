import type {MeshStandardMaterial} from 'three';

/** Wet stone and asphalt darken, with narrower reflections from the existing sky. */
export function dampSurface(material:MeshStandardMaterial,strength=1){
  const dryColor=material.color.clone(),dryRoughness=material.roughness;
  return (damp:boolean)=>{
    const amount=damp?strength:0;
    material.color.copy(dryColor).multiplyScalar(1-.22*amount);
    material.roughness=dryRoughness*(1-.36*amount);
  };
}
