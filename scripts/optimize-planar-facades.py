"""Retessellate planar facade panels while retaining the original window cutouts and PBR UVs."""
import hashlib
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / 'public/shooter/models'
TYPES = {5123: '<u2', 5125: '<u4', 5126: '<f4'}
DIMS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}


def cross(a, b):
    return a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]


def tiles(positions, normals, uv, indices):
    # The selected facade panels have constant normals and a single affine UV chart.
    xy = positions[:, :2]
    assert np.ptp(positions[:, 2]) < 1e-5 and np.ptp(normals, axis=0).max() < 1e-5
    basis = np.column_stack((xy, np.ones(len(xy))))
    mapping = np.linalg.lstsq(basis, uv, rcond=None)[0]
    assert np.max(np.abs(basis @ mapping - uv)) < 1e-5
    points, inverse = np.unique(xy.round(4), axis=0, return_inverse=True)
    triangles = inverse[indices.reshape(-1, 3)]
    pairs = np.concatenate([triangles[:, [0, 1]], triangles[:, [1, 2]], triangles[:, [2, 0]]])
    edges, counts = np.unique(np.sort(pairs, axis=1), axis=0, return_counts=True)
    assert counts.max() <= 2
    start, end = points[edges[counts == 1]].transpose(1, 0, 2)
    vertical = start[:, 0] == end[:, 0]
    horizontal = start[:, 1] == end[:, 1]
    assert np.all(vertical | horizontal)
    xs, ys = np.unique(start[vertical, 0]), np.unique(start[horizontal, 1])
    a, b, c = points[triangles].transpose(1, 0, 2)
    signed_areas = cross(b-a, c-a)
    winding = np.sign(signed_areas.sum())
    assert np.all(winding*signed_areas >= 0)
    verts, out, area = [], [], 0.
    for x0, x1 in zip(xs, xs[1:]):
        for y0, y1 in zip(ys, ys[1:]):
            # Every boundary segment was used to partition the grid. Coverage is constant inside a cell.
            center = np.array([(x0+x1)/2, (y0+y1)/2])
            sides = np.stack([cross(b-a, center-a), cross(c-b, center-b), cross(a-c, center-c)])
            if not np.any((signed_areas != 0) & np.all(sides*winding >= -1e-8, axis=0)):
                continue
            base = len(verts)
            verts.extend([(x0,y0), (x1,y0), (x1,y1), (x0,y1)])
            faces = [0,1,2,0,2,3] if winding>0 else [2,1,0,3,2,0]
            out.extend(base+i for i in faces)
            area += (x1-x0)*(y1-y0)
    assert abs(area-abs(signed_areas.sum())/2) < .001
    pos = np.column_stack((verts, np.full(len(verts), positions[0, 2])))
    mapped = np.column_stack((verts, np.ones(len(verts)))) @ mapping
    return pos, np.tile(normals[0], (len(verts),1)), mapped, np.array(out).reshape(-1,1)


def optimize(pack, meshes):
    folder = ROOT / pack
    source, blob = folder/'runtime.gltf', folder/'runtime.bin'
    doc = json.loads(source.read_text('utf-8'))
    original = blob.read_bytes()
    arrays = []
    for accessor in doc['accessors']:
        view = doc['bufferViews'][accessor['bufferView']]
        assert not accessor.get('byteOffset') and not view.get('byteStride')
        dim = DIMS[accessor['type']]
        arrays.append(np.frombuffer(original, TYPES[accessor['componentType']], dim*accessor['count'],
                                    view.get('byteOffset', 0)).reshape(-1,dim))
    before = after = 0
    for mesh in meshes:
        [primitive] = doc['meshes'][mesh]['primitives']
        ids = [primitive['attributes'][key] for key in ('POSITION','NORMAL','TEXCOORD_0')]+[primitive['indices']]
        before += len(arrays[ids[-1]])//3
        data = tiles(*(arrays[i] for i in ids))
        after += len(data[-1])//3
        for idx, values in zip(ids, data):
            arrays[idx] = values.astype(arrays[idx].dtype)
            accessor = doc['accessors'][idx]
            accessor['count'] = len(values)
            for field, extrema in [('min',np.min),('max',np.max)]:
                if field in accessor:
                    accessor[field] = extrema(arrays[idx],axis=0).tolist()
    binary = bytearray()
    assert len({a['bufferView'] for a in doc['accessors']}) == len(doc['bufferViews'])
    for accessor,array in zip(doc['accessors'],arrays):
        binary.extend(b'\0'*(-len(binary)%4))
        view = doc['bufferViews'][accessor['bufferView']]
        view.update(byteOffset=len(binary), byteLength=array.nbytes)
        binary.extend(array.tobytes())
    doc['buffers'][0]['byteLength'] = len(binary)
    source.write_text(json.dumps(doc, separators=(',',':')),encoding='utf-8')
    blob.write_bytes(binary)
    provenance = folder/'provenance.json'
    record = json.loads(provenance.read_text('utf-8'))
    record['runtime'].update(geometryBytes=len(binary),sha256=hashlib.sha256(binary).hexdigest(),
        modifications='Three selected and recentered facade modules. Planar wall grids retessellated along their original outlines and openings; original UV mapping and window detail retained.')
    provenance.write_text(json.dumps(record, indent=2)+'\n',encoding='utf-8')
    print(pack, before, '->', after, 'planar wall triangles;', len(original), '->',len(binary),'bytes')


if __name__ == '__main__':
    optimize('modular_factory_facade', [0])
    optimize('modular_urban_apartments_facade', [0,1,3])
