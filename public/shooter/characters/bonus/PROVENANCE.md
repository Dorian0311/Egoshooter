# User-provided bonus figures

These optional local character skins were converted from files supplied by the user:

| Selection | Archive | Processing |
| --- | --- | --- |
| Deadpool | AnimRig_Deadpool_Promo.zip | Deadpool_Char.fbx; source guns omitted, five material groups |
| Harley Quinn | harley-quinn.zip | HQ Sport.fbx; deform mesh only, controls/bat omitted |
| Rocket | rocket-racoontexturedrigged.zip | Rocket Racoon.fbx; three material groups |
| Homer Simpson | homer-simpson.zip | Nested PC Computer - The Simpsons Hit & Run - Homer.zip; homer.fbx |

No purchase, additional download or downloaded script execution was required.
This is not a declaration that the models are CC0 or cleared for redistribution.
The Deadpool promo rig is associated with Kiel Figgins / 3dfiggins.com and personal,
noncommercial usage. Homer is identified in the supplied archive as a game extract.
Redistribution permission for these character assets has not been established.
Keep that distinction when packaging or publishing the project.

Conversion uses scripts/convert-playable-characters.mjs and
scripts/pack-character-textures.py. Original bind poses are baked, unused meshes
and controls removed, geometry grouped by material, textures capped at 1024 px
and embedded in GLB. Per-file JSON records sizes, triangle counts and SHA-256.
Runtime walking and head movement are procedural; no complete motion-capture
or weapon-specific animation library was supplied. All figures use the existing
server hitboxes and rules; Rocket is deliberately scaled to player height.

## Leatherface
User-provided Texas_Chainsaw_-_Leatherface.usdz. Static mesh without skeleton or animation clips. Reduced from 623,274 to 52,970 triangles, one material, embedded 1024px texture. Conversion: scripts/convert-leatherface.py. Fixed source pose with subtle movement feedback; no separate chainsaw weapon or attack behavior. Redistribution permission has not been established.

## Commander Easter egg
User-provided nazi-commander-1946-wolf-old-blood.zip. Static FBX with textures; no skeleton or animation. Now also selectable in the regular gallery at user request; fixed source pose, not a historically accurate uniform. 13,683 triangles, five meshes, 1024px textures. Conversion: scripts/convert-commander.mjs and scripts/pack-character-textures.py commander. Game-derived asset; redistribution permission not established.
