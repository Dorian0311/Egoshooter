"""Convert only the CC0 MakeHuman body and rig data into a compact runtime mesh."""
from pathlib import Path
import json
import math
import hashlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/shooter/characters/source"
vertices, uvs, faces = [], [], []
group = ""
for line in (SOURCE / "base.obj").read_text(encoding="utf-8").splitlines():
    parts = line.split()
    if not parts:
        continue
    if parts[0] == "v":
        vertices.append([float(v) for v in parts[1:4]])
    elif parts[0] == "vt":
        uvs.append([float(v) for v in parts[1:3]])
    elif parts[0] == "g":
        group = parts[1]
    elif parts[0] == "f" and group == "body":
        face = [[int(x)-1 for x in token.split("/")[:2]] for token in parts[1:]]
        for i in range(1, len(face)-1):
            faces.append([face[0], face[i], face[i+1]])
# Apply the CC0 adult male macro target before calculating body bounds and rig joints.
for target in ["caucasian-male-young.target", "universal-male-young-averagemuscle-averageweight.target"]:
    for row in (SOURCE / target).read_text(encoding="utf-8").splitlines():
        if not row.strip() or row.startswith("#"):
            continue
        values = row.split()
        if len(values) == 4:
            index = int(values[0])
            vertices[index] = [vertices[index][a] + float(values[a+1]) for a in range(3)]
rig = json.loads((SOURCE / "default.mhskel").read_text())
weights = json.loads((SOURCE / "default_weights.mhw").read_text())
if rig["license"] != "CC0" or weights["license"] != "CC0":
    raise RuntimeError("Asset license mismatch")
used = {v for face in faces for v, _ in face}
bottom = min(vertices[v][1] for v in used)
scale = 1.78 / (max(vertices[v][1] for v in used)-bottom)

def position(value):
    x, y, z = value
    return [-x*scale, (y-bottom)*scale, -z*scale]

def joint(name):
    indexes = rig["joints"][name]
    return position([sum(vertices[i][a] for i in indexes)/len(indexes) for a in range(3)])

names = list(rig["bones"])
bones = [{"name": name, "parent": names.index(bone["parent"]) if bone["parent"] else -1,
          "head": joint(bone["head"]), "tail": joint(bone["tail"])}
         for name, bone in rig["bones"].items()]
skin_bones = set()
for i, name in enumerate(names):
    ancestor = name
    while ancestor:
        if ancestor == "head" or ancestor in ("neck02", "neck03") or ancestor.startswith("wrist."):
            skin_bones.add(i)
            break
        ancestor = rig["bones"][ancestor]["parent"]
influences = {}
for name, entries in weights["weights"].items():
    for vertex, weight in entries:
        influences.setdefault(vertex, []).append((names.index(name), weight))
positions, texcoords, skin_indexes, skin_weights, indexes, categories = [], [], [], [], [], []
lookup = {}
for face in faces:
    triangle = []
    for vertex, uv in face:
        key = (vertex, uv)
        if key not in lookup:
            lookup[key] = len(positions)//3
            p = position(vertices[vertex])
            skin = sorted(influences.get(vertex, [(names.index("root"), 1)]), key=lambda x: -x[1])[:4]
            total = sum(w for _, w in skin)
            is_skin = sum(w for i,w in skin if i in skin_bones) > .45
            category = 1 if is_skin else 2 if p[1] < .20 else 0
            # A fitted uniform envelope: hands/head retain the original anatomy.
            if category == 0:
                if .84 < p[1] < 1.44:
                    p[0] *= 1.09
                    p[2] *= 1.16
                elif p[1] < .84:
                    p[0] *= 1.025
                    p[2] *= 1.08
            positions.extend(round(c, 6) for c in p)
            texcoords.extend(uvs[uv] if uv < len(uvs) else [0,0])
            skin_indexes.extend([i for i,_ in skin]+[0]*(4-len(skin)))
            skin_weights.extend([round(w/total,6) for _,w in skin]+[0]*(4-len(skin)))
            categories.append(category)
        triangle.append(lookup[key])
    indexes.extend(triangle)
asset = {"license": "CC0-1.0", "positions": positions, "uv": texcoords, "indices": indexes,
         "skinIndex": skin_indexes, "skinWeight": skin_weights, "categories": categories, "bones": bones}
destination = ROOT / "public/shooter/characters/humanoid.json"
destination.write_text(json.dumps(asset, separators=(",", ":")), encoding="utf-8")
manifest={"source":"https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data",
          "license":"CC0-1.0", "changes":"Body extraction, uniform envelope, normalization to 1.78 m, top-four skin weights, triangulation",
          "files":{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCE.iterdir()},
          "runtime_sha256":hashlib.sha256(destination.read_bytes()).hexdigest()}
(destination.parent / "manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
print(f"Converted CC0 human: {len(positions)//3} vertices, {len(indexes)//3} triangles, {len(bones)} bones")
