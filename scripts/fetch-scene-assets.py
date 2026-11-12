"""Fetch bounded, verified CC0 scene assets, without executing downloaded files."""
from pathlib import Path
import hashlib
import json
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location("material_fetch", ROOT / "scripts/fetch-art-assets.py")
module = module_from_spec(spec)
spec.loader.exec_module(module)
fetch = module.fetch

def save(folder: Path, relative: str, info: dict) -> dict:
    path = (folder / relative).resolve()
    if not path.is_relative_to(folder.resolve()):
        raise RuntimeError("Unsafe asset path")
    data = fetch(info["url"])
    if len(data) != info["size"] or hashlib.md5(data).hexdigest() != info["md5"]:
        raise RuntimeError(f"Asset checksum mismatch: {relative}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {"path": str(path.relative_to(ROOT / "public")).replace("\\", "/"),
            "source": info["url"], "sha256": hashlib.sha256(data).hexdigest()}

records = []
for name in ["wooden_military_crate", "barrel_03"]:
    metadata = json.loads(fetch(f"https://api.polyhaven.com/files/{name}"))
    asset = metadata["gltf"]["1k"]["gltf"]
    folder = ROOT / "public/shooter/models" / name
    files = [save(folder, "asset.gltf", asset)]
    for relative, info in asset.get("include", {}).items():
        files.append(save(folder, relative, info))
    records.append({"name": name, "license": "CC0-1.0",
                    "source": f"https://polyhaven.com/a/{name}", "files": files})
name = "kloppenheim_06_puresky"
metadata = json.loads(fetch(f"https://api.polyhaven.com/files/{name}"))
files = [save(ROOT / "public/shooter/environment", "sky.hdr", metadata["hdri"]["1k"]["hdr"])]
records.append({"name": name, "license": "CC0-1.0", "source": f"https://polyhaven.com/a/{name}", "files": files})
(ROOT / "public/shooter/scene-assets.json").write_text(json.dumps(records, indent=2)+"\n", encoding="utf-8")
print(f"Verified {len(records)} CC0 scene assets, {sum(len(r['files']) for r in records)} files")
