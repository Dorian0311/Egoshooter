"""Convert the user-supplied static USDZ tank to a compact, textured GLB.

Requires usd-core and fast-simplification in research/usd-tools, numpy, scipy, Pillow.
No scripts embedded in the source asset are executed.
"""
import hashlib
import io
import json
import pathlib
import struct
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path('research/usd-tools').resolve()))
import fast_simplification
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from pxr import Usd, UsdGeom

source = pathlib.Path(sys.argv[1])
output = pathlib.Path('public/shooter/models/maus')
output.mkdir(parents=True, exist_ok=True)
stage = Usd.Stage.Open(str(source.resolve()))
cache = UsdGeom.XformCache()
groups = {name: [] for name in ('chassis', 'Maus')}
geometry_cache = {}
original_triangles = 0
for prim in stage.Traverse():
    if not prim.IsA(UsdGeom.Mesh):
        continue
    mesh = UsdGeom.Mesh(prim)
    points = np.asarray(mesh.GetPointsAttr().Get(), dtype=np.float64)
    counts = np.asarray(mesh.GetFaceVertexCountsAttr().Get())
    indices = np.asarray(mesh.GetFaceVertexIndicesAttr().Get())
    if not np.all(counts == 3):
        raise ValueError('Expected triangulated source mesh')
    faces = indices.reshape(-1, 3)
    uvvar = UsdGeom.PrimvarsAPI(prim).GetPrimvar('st0')
    if uvvar.GetInterpolation() != 'vertex':
        raise ValueError('Expected vertex texture coordinates')
    uv = np.asarray(uvvar.ComputeFlattened(), dtype=np.float32)
    original_triangles += len(faces)
    key = hashlib.sha256(points.tobytes() + faces.tobytes() + uv.tobytes()).digest()
    if key not in geometry_cache:
        if len(faces) > 150:
            reduced, faces = fast_simplification.simplify(points.copy(), faces.astype(np.int32).copy(), target_reduction=.94)
            uv = uv[cKDTree(points).query(reduced)[1]]
            points = reduced
        geometry_cache[key] = (points, faces, uv)
    points, faces, uv = geometry_cache[key]
    matrix = np.asarray(cache.GetLocalToWorldTransform(prim))
    world = np.c_[points, np.ones(len(points))] @ matrix
    if np.linalg.det(matrix[:3, :3]) < 0:
        faces = faces[:, ::-1]
    owner = prim
    targets = []
    while owner and not targets:
        targets = owner.GetRelationship('material:binding').GetTargets()
        owner = owner.GetParent()
    material = str(targets[0]).rsplit('/', 1)[-1] if targets else ''
    if material not in groups:
        raise ValueError('Unknown material: ' + material)
    groups[material].append((world[:, :3], faces, uv))

all_points = np.concatenate([p for group in groups.values() for p, _, _ in group])
low, high = all_points.min(axis=0), all_points.max(axis=0)
scale = 10 / (high[2] - low[2])
center = (low + high) / 2
center[1] = low[1]
doc = {'asset': {'version': '2.0', 'generator': 'Altstadt static USD converter'},
       'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
       'meshes': [{'primitives': []}], 'materials': [], 'textures': [],
       'images': [], 'buffers': [], 'bufferViews': [], 'accessors': []}
binary = bytearray()

def view(data):
    while len(binary) % 4:
        binary.append(0)
    index = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)})
    binary.extend(data)
    return index

def accessor(array, kind, component=5126):
    array = np.asarray(array, dtype='<u4' if component == 5125 else '<f4')
    item = {'bufferView': view(array.tobytes()), 'componentType': component,
            'count': len(array), 'type': kind}
    if kind == 'VEC3':
        item.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
    doc['accessors'].append(item)
    return len(doc['accessors']) - 1

triangles = 0
with zipfile.ZipFile(source) as archive:
    for material, parts in groups.items():
        vertices, faces, uvs, offset = [], [], [], 0
        for p, f, uv in parts:
            vertices.append((p - center) * scale)
            faces.append(f + offset)
            uvs.append(uv)
            offset += len(p)
        p, f, uv = np.concatenate(vertices), np.concatenate(faces), np.concatenate(uvs).copy()
        uv[:, 1] = 1 - uv[:, 1]
        normals = np.zeros_like(p)
        face_normals = np.cross(p[f[:, 1]] - p[f[:, 0]], p[f[:, 2]] - p[f[:, 0]])
        for column in range(3):
            np.add.at(normals, f[:, column], face_normals)
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-10)
        tex = len(doc['textures'])
        doc['images'].append({'bufferView': view(archive.read('0/' + material + '_diffuse.jpg')), 'mimeType': 'image/jpeg'})
        doc['textures'].append({'source': len(doc['images']) - 1})
        gloss = Image.open(io.BytesIO(archive.read('0/' + material + '_specularGlossiness_gloss.jpg'))).convert('L')
        rough = np.asarray(gloss)
        packed = np.zeros((*rough.shape, 3), dtype=np.uint8)
        packed[:, :, 0] = 255
        packed[:, :, 1] = np.maximum(255 - rough, 85)
        buf = io.BytesIO()
        Image.fromarray(packed).save(buf, format='PNG')
        doc['images'].append({'bufferView': view(buf.getvalue()), 'mimeType': 'image/png'})
        doc['textures'].append({'source': len(doc['images']) - 1})
        doc['materials'].append({'name': material, 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': tex}, 'metallicFactor': 0,
            'roughnessFactor': 1, 'metallicRoughnessTexture': {'index': tex + 1}}})
        doc['meshes'][0]['primitives'].append({'attributes': {
            'POSITION': accessor(p, 'VEC3'), 'NORMAL': accessor(normals, 'VEC3'),
            'TEXCOORD_0': accessor(uv, 'VEC2')},
            'indices': accessor(f.reshape(-1), 'SCALAR', 5125), 'material': len(doc['materials']) - 1})
        triangles += len(f)

while len(binary) % 4:
    binary.append(0)
doc['buffers'] = [{'byteLength': len(binary)}]
data = json.dumps(doc, separators=(',', ':')).encode()
data += b' ' * (-len(data) % 4)
glb = struct.pack('<III', 0x46546c67, 2, 28 + len(data) + len(binary))
glb += struct.pack('<II', len(data), 0x4e4f534a) + data
glb += struct.pack('<II', len(binary), 0x004e4942) + binary
(output / 'maus.glb').write_bytes(glb)
report = {'sourceFile': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'sourceTriangles': original_triangles, 'triangles': triangles, 'bytes': len(glb),
          'dimensions': ((high - low) * scale).tolist(),
          'license': 'User-provided asset; original author, source URL and redistribution license not supplied.',
          'usage': 'Local static scenery prototype; not a historical placement claim.',
          'processing': 'Static transforms baked, mesh reduction, nearest-vertex UV transfer, roughness from gloss.'}
(output / 'provenance.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))

