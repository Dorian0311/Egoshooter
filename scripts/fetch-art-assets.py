"""Download a bounded set of CC0 PBR textures; preserve provenance and hashes."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ["cobblestone_floor_02", "damaged_plaster", "sandstone_blocks_04",
          "wood_planks_dirt", "rusty_metal_02", "snow_02", "rocky_terrain_02"]
CHANNELS = {"albedo": ("diff", "Diffuse"), "normal": ("nor_gl",),
            "roughness": ("rough", "Rough")}

def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Altstadt1940/1.0 (CC0 asset preparation)"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()

def material(name: str) -> dict:
    metadata = json.loads(fetch(f"https://api.polyhaven.com/files/{name}"))
    folder = ROOT / "public/shooter/materials" / name
    folder.mkdir(parents=True, exist_ok=True)
    files = []
    for channel, keys in CHANNELS.items():
        entries = next((metadata[k] for k in keys if k in metadata), None)
        if entries is None:
            raise RuntimeError(f"Required channel missing: {name}/{channel}")
        remote = entries["1k"]["jpg"]
        target = folder / f"{channel}.jpg"
        data = fetch(remote["url"])
        if len(data) != remote["size"] or not data.startswith(b"\xff\xd8"):
            raise RuntimeError(f"Invalid JPEG download: {name}/{channel}")
        if hashlib.md5(data).hexdigest() != remote["md5"]:
            raise RuntimeError(f"Checksum mismatch: {name}/{channel}")
        target.write_bytes(data)
        files.append({"channel": channel, "source": remote["url"],
                      "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    return {"name": name, "source": f"https://polyhaven.com/a/{name}",
            "license": "CC0-1.0", "license_url": "https://polyhaven.com/license", "files": files}

if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(material, ASSETS))
    (ROOT / "public/shooter/materials/manifest.json").write_text(
        json.dumps({"provider": "Poly Haven", "materials": records}, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(records)} CC0 materials / {sum(len(r['files']) for r in records)} JPEG maps")
