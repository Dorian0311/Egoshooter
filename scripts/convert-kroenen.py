"""Convert the supplied Kroenen USDZ into one textured, skinned GLB; no source scripts execute."""
import sys, pathlib, json, struct, io, hashlib, zipfile
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path('research/usd-tools').resolve()))
import numpy as np
from PIL import Image
from pxr import Usd, UsdGeom, UsdSkel, UsdShade

source = pathlib.Path(sys.argv[1])
stage = Usd.Stage.Open(str(source.resolve()))
cache = UsdGeom.XformCache()
skel = next(UsdSkel.Skeleton(p) for p in stage.Traverse() if p.IsA(UsdSkel.Skeleton))
joints = list(skel.GetJointsAttr().Get())
binds = list(skel.GetBindTransformsAttr().Get())
rests = list(skel.GetRestTransformsAttr().Get())
skel_world = np.asarray(cache.GetLocalToWorldTransform(skel.GetPrim()))
parts = []
materials = []
for prim in stage.Traverse():
    if not prim.IsA(UsdGeom.Mesh):
        continue
    mesh = UsdGeom.Mesh(prim)
    binding = UsdSkel.BindingAPI(prim)
    material, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
    name = material.GetPrim().GetName()
    if name not in materials:
        materials.append(name)
    points = np.asarray(mesh.GetPointsAttr().Get(), dtype=np.float64)
    world = np.asarray(cache.GetLocalToWorldTransform(prim))
    world_points = (np.c_[points, np.ones(len(points))] @ world)[:, :3]
    faces = np.asarray(mesh.GetFaceVertexIndicesAttr().Get(), dtype=np.int32)
    counts = list(mesh.GetFaceVertexCountsAttr().Get())
    uvvar = UsdGeom.PrimvarsAPI(prim).GetPrimvar('st0')
    uv = np.asarray(uvvar.ComputeFlattened(), dtype=np.float64)
    jointvar, weightvar = binding.GetJointIndicesPrimvar(), binding.GetJointWeightsPrimvar()
    size = jointvar.GetElementSize()
    indices = np.asarray(jointvar.ComputeFlattened(), dtype=np.int32).reshape(-1, size)
    weights = np.asarray(weightvar.ComputeFlattened(), dtype=np.float64).reshape(-1, size)
    palette = list(binding.GetJointsAttr().Get() or joints)
    remap = np.array([joints.index(j) for j in palette])
    indices = remap[indices]
    selected = np.argsort(-weights, axis=1)[:, :4]
    indices = np.take_along_axis(indices, selected, axis=1)
    weights = np.take_along_axis(weights, selected, axis=1)
    if indices.shape[1] < 4:
        indices = np.pad(indices, ((0, 0), (0, 4-indices.shape[1])))
        weights = np.pad(weights, ((0, 0), (0, 4-weights.shape[1])))
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-8)
    corner_indices = []
    cursor = 0
    for count in counts:
        for i in range(1, count-1):
            corner_indices.extend([cursor, cursor+i, cursor+i+1])
        cursor += count
    corners = np.asarray(corner_indices)
    vertices = faces[corners]
    part_uv = uv[corners] if uvvar.GetInterpolation() == 'faceVarying' else uv[vertices]
    parts.append((world_points[vertices], part_uv.copy(), indices[vertices], weights[vertices], materials.index(name)))

all_points = np.concatenate([p[0] for p in parts])
low, high = all_points.min(0), all_points.max(0)
center = (low+high)/2
center[1] = low[1]
scale = 1.78/(high[1]-low[1])
normalization = np.eye(4)
normalization[:3, :3] = np.diag([-scale, scale, -scale])
normalization[3, :3] = -center @ normalization[:3, :3]
position, normals, texcoords, skin_indices, skin_weights = [], [], [], [], []
atlas_size, tile = 1024, 340
albedo = Image.new('RGB', (atlas_size, atlas_size), '#777777')
normal = Image.new('RGB', (atlas_size, atlas_size), (128, 128, 255))
with zipfile.ZipFile(source) as archive:
    files = archive.namelist()
    for i, name in enumerate(materials):
        for suffix, atlas in [('baseColor', albedo), ('normal', normal)]:
            match = next((f for f in files if pathlib.PurePosixPath(f).stem.lower() == (name+'_'+suffix).lower()), None)
            if match:
                image = Image.open(io.BytesIO(archive.read(match))).convert('RGB').resize((tile-4, tile-4), Image.Resampling.LANCZOS)
                # Duplicate edge pixels into the tile gutter to prevent seams at a distance.
                padded = image.resize((tile, tile), Image.Resampling.NEAREST)
                padded.paste(image, (2, 2))
                atlas.paste(padded, ((i % 3)*tile, (i//3)*tile))
for points, uv, indices, weights, material_index in parts:
    p = (np.c_[points, np.ones(len(points))] @ normalization)[:, :3]
    face = p.reshape(-1, 3, 3)
    n = np.cross(face[:, 1]-face[:, 0], face[:, 2]-face[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-10)
    # Source meshes use repeated UV tiles, including negative V coordinates.
    # Shift the whole island together so boundary vertices remain at 0 and 1.
    uv -= np.floor((uv.min(axis=0)+uv.max(axis=0))/2)
    uv[:, 0] = ((material_index % 3)*tile+2+uv[:, 0]*(tile-4))/atlas_size
    # glTF images use a top-left origin (GLTFLoader keeps texture.flipY=false).
    uv[:, 1] = ((material_index//3)*tile+2+(1-uv[:, 1])*(tile-4))/atlas_size
    position.extend(p);normals.extend(np.repeat(n, 3, axis=0));texcoords.extend(uv);skin_indices.extend(indices);skin_weights.extend(weights)

doc = {'asset': {'version': '2.0', 'generator': 'Kroenen USDZ skin-preserving converter'}, 'scene': 0, 'scenes': [{'nodes': [0, len(joints)+1]}], 'nodes': [], 'meshes': [], 'skins': [], 'materials': [], 'images': [], 'textures': [], 'buffers': [], 'bufferViews': [], 'accessors': []}
binary = bytearray()
def view(data):
    binary.extend(b'\0'*(-len(binary) % 4));index = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)})
    binary.extend(data);return index
def accessor(values, kind, component=5126):
    array = np.asarray(values, dtype='<u2' if component == 5123 else '<f4')
    entry = {'bufferView': view(array.tobytes()), 'componentType': component, 'count': len(array), 'type': kind}
    if kind == 'VEC3':entry.update(min=array.min(0).tolist(), max=array.max(0).tolist())
    doc['accessors'].append(entry);return len(doc['accessors'])-1
for i, joint in enumerate(joints):
    name = str(joint).split('/')[-1]
    local = np.asarray(rests[i])
    if '/' not in str(joint):local = local @ skel_world @ normalization
    node = {'name': name, 'matrix': local.flatten().tolist()}
    children = [n for n, j in enumerate(joints) if '/'.join(str(j).split('/')[:-1]) == str(joint)]
    if children:node['children'] = children
    doc['nodes'].append(node)
inverse_binds = [np.linalg.inv(np.asarray(b) @ skel_world @ normalization).flatten() for b in binds]
doc['skins'] = [{'joints': list(range(len(joints))), 'skeleton': 0, 'inverseBindMatrices': accessor(inverse_binds, 'MAT4')}]
doc['nodes'].append({'name': 'KroenenMesh', 'mesh': 0, 'skin': 0})
# Mesh index is len(joints), not len(joints)+1.
doc['scenes'][0]['nodes'] = [0, len(joints)]
attributes = {'POSITION': accessor(position, 'VEC3'), 'NORMAL': accessor(normals, 'VEC3'), 'TEXCOORD_0': accessor(texcoords, 'VEC2'), 'JOINTS_0': accessor(skin_indices, 'VEC4', 5123), 'WEIGHTS_0': accessor(skin_weights, 'VEC4')}
doc['meshes'] = [{'primitives': [{'attributes': attributes, 'material': 0}]}]
for image, fmt in [(albedo, 'JPEG'), (normal, 'PNG')]:
    output = io.BytesIO();image.save(output, format=fmt, **({'quality': 92} if fmt == 'JPEG' else {}))
    doc['images'].append({'bufferView': view(output.getvalue()), 'mimeType': 'image/jpeg' if fmt == 'JPEG' else 'image/png'})
    doc['textures'].append({'source': len(doc['images'])-1})
doc['materials'] = [{'name': 'Kroenen black leather atlas', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': .08, 'roughnessFactor': .42}, 'normalTexture': {'index': 1}, 'doubleSided': True}]
binary.extend(b'\0'*(-len(binary) % 4));doc['buffers'] = [{'byteLength': len(binary)}]
encoded = json.dumps(doc, separators=(',', ':')).encode();encoded += b' '*(-len(encoded) % 4)
glb = struct.pack('<III', 0x46546c67, 2, 28+len(encoded)+len(binary))+struct.pack('<II', len(encoded), 0x4e4f534a)+encoded+struct.pack('<II', len(binary), 0x004e4942)+binary
target = pathlib.Path('public/shooter/characters/bonus/kroenen.glb');target.write_bytes(glb)
report = {'id': 'kroenen', 'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'bones': len(joints), 'triangles': len(position)//3, 'draws': 1, 'bytes': len(glb), 'sha256': hashlib.sha256(glb).hexdigest(), 'maxTextureSize': atlas_size, 'appearance': 'Black leather coat matching the supplied reference; normalized source UV tile offsets and glTF top-left atlas UVs; roughness 0.42, metallic 0.08.', 'license': 'User-provided local asset; redistribution rights not established.', 'animation': 'Preserved skeleton; source contains no timed motion. Runtime retargeting supplies movement.'}
target.with_suffix('.json').write_text(json.dumps(report, indent=2));print(json.dumps(report))
