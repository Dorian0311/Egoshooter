# Animation and detail references

Reviewed on 16 November 2026 using the creators' own pages:

- [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html): general locomotion, crawling and death motions, offered under CC0. The site distinguishes free Standard content from larger engine/source editions.
- [Quaternius Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html): general melee/armed combinations and separate hit/recovery actions, offered under CC0, with free and paid edition differences.
- [three.js Ammo break example](https://github.com/mrdoob/three.js/blob/dev/examples/physics_ammo_break.html): impact-driven motion and fracture as a technical physics reference. The repository is MIT licensed.

These are research references, not a claim that proprietary or paid animation clips are included. Body-part flight, corpse handling and the head-removal interaction are implemented in the game's own 3D runtime so they follow actual collision, pose and source-character identity. No AI-generated replacement face is used. The wound mesh/material code is repository-authored, with one draw per wound and one shared 128px procedural detail texture.

The portrait files derive from the original game assets and preserve their rights; see `PROVENANCE.json` and the existing character-specific provenance files. This note does not assign CC0 or new redistribution permission to the bonus character models.
