# Assets and source

Procedural city geometry, uniform details and synthesized sounds are authored by this project. Imported figures, weapons and textures have separate provenance as listed below and beside their assets. PBR textures under public/shooter/materials are CC0 assets from Poly Haven (https://polyhaven.com/license); manifest.json records original URLs and SHA-256 checksums. Powered by Poly Haven. No Saltline code has been copied; its publicly accessible mirror was inspected as a visual and technical reference, not treated as a code reuse license.

Three.js (MIT), React (MIT), Colyseus and its SDK (MIT), Express (MIT), jose (MIT), node-postgres (MIT), and build dependencies retain their licenses in node_modules. Distributions must retain the applicable package notices. Reference projects were evaluated as architectural examples; their third-party assets are not included.

Human body geometry, skeleton and skin weights derive from MakeHuman Community's hm08 assets at commit a8bc2d54ff0ac92e78ff71431b1023eda42bf482, explicitly released as CC0 in September 2020. Original asset license headers are retained under public/shooter/characters/source. manifest.json records SHA-256 hashes and the conversion. No MakeHuman application code was incorporated.

## Anatomical skin texture
MakeHuman system assets, middleage_lightskinned_male_diffuse, CC0-1.0. Verified SHA-256 and pinned OpenRCsimulator mirror URL in public/shooter/characters/skin.source.json. Download recipe: scripts/fetch-skin.py. Original catalog: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html .
CounterStrike (lrusso) and Saltline were researched only; no proprietary Counter-Strike assets or unlicensed Saltline code copied.

## Realism update
The rock_01 and plastered_wall_05 PBR maps are Poly Haven CC0 assets. Each folder
under public/shooter/materials includes provenance.json with source URLs and
verified hashes. scripts/fetch-realism-materials.py reproduces the download.
Convex rock geometry, matching collision planes and architectural relief are
authored by this project. The G36 is a user-supplied asset; its redistribution
license was not supplied (see public/shooter/models/g36-provenance.json).
Muster-derived weapons/hands retain MIT notices in client/vendor/muster/LICENSE
and public/shooter/models/LICENSE-muster.txt. The imported greatcoat retains its
CC BY 4.0 attribution in public/shooter/characters/greatcoat/CREDITS.txt.

## Textured weapons and new map surfaces

The five models in `public/shooter/models/realistic` are CC BY 4.0:
Kar98k by danscrivy; MP-40 (Rusty) by FOXYSCA; M1 Garand by Ismaele.Giraldo;
Thompson SMG by Sammi_stapley; Luger P08 by zdani98. Original Sketchfab pages,
Zenodo mirrors, verified source/runtime checksums and modifications are recorded
in that directory's `provenance.json` and `CREDITS.txt`. Source geometry and
textures are adapted in scale and orientation; embedded textures are capped at
2048 pixels and JPEG encoded. Attribution is also linked from the lobby.

The new 2K roof_slates_02, plastered_wall_02, cobblestone_floor_02,
aerial_grass_rock and sand_01 material maps are Poly Haven CC0 assets.
Per-folder provenance records retain download URLs and verified SHA-256 hashes.
Map layouts, radar, military props and architectural dressing are project work.

## User-provided bonus characters
Deadpool, Harley Quinn, Rocket and Homer were converted from user-supplied
archives. These are not claimed to be CC0 or cleared for redistribution. See
public/shooter/characters/bonus/PROVENANCE.md and the per-model JSON records for
the known sources, processing and limits. Original archives are not included.

## Environment geometry and locomotion

Poly Haven's modular_factory_facade, modular_urban_apartments_facade,
rock_moss_set_01, grass_medium_01 and wild_rooibos_bush are CC0 assets.
Original files, verified hashes and source URLs are retained in each model
folder's provenance.json. Facade runtime files contain selected wall/window
modules, centered and scaled for the existing building entrances and floors.
Download recipe: scripts/fetch-environment-upgrade.py; conversion:
scripts/prepare-facade-assets.mjs. Catalog: https://polyhaven.com/models .

The eight locomotion clips derive from Quaternius Universal Animation Library,
CC0: https://quaternius.com/packs/universalanimationlibrary.html .
Source export by KinemIQ: https://huggingface.co/datasets/Kinemiq/free-game-animations .
The clips are retargeted to the existing MakeHuman skeleton, sampled at 30 fps,
converted to in-place movement and grounded. Crouch strength is adjusted to the
playable silhouette. Download hashes and modifications are recorded in
public/shooter/animations/provenance.json; conversion is reproducible with
scripts/retarget-locomotion.mjs.
