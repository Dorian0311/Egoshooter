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

## User-provided bonus characters
Deadpool, Harley Quinn, Rocket and Homer were converted from user-supplied
archives. These are not claimed to be CC0 or cleared for redistribution. See
public/shooter/characters/bonus/PROVENANCE.md and the per-model JSON records for
the known sources, processing and limits. Original archives are not included.
