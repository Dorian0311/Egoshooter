"""Prepare the verified MIT Rocketbox civilian without changing its skin or textures."""
from pathlib import Path
import copy
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'research/free-characters/rocketbox-male-adult-03'
TARGET = ROOT / 'public/shooter/characters/civilian'
raw = (SOURCE / 'male-adult-03-candidate.glb').read_bytes()
json_length, json_type = struct.unpack_from('<II', raw, 12)
assert json_type == 0x4E4F534A
document = json.loads(raw[20:20 + json_length])
binary_start = 20 + json_length
binary_length, binary_type = struct.unpack_from('<II', raw, binary_start)
assert binary_type == 0x004E4942
binary = bytearray(raw[binary_start + 8:binary_start + 8 + binary_length])
before = after = 0
for mesh in document['meshes']:
    merged = {}
    for primitive in mesh['primitives']:
        assert primitive.get('mode', 4) == 4
        assert not primitive.get('targets')
        key = (primitive['material'], json.dumps(primitive['attributes'], sort_keys=True))
        entry = merged.setdefault(key, {'source': primitive, 'indices': []})
        accessor = document['accessors'][primitive['indices']]
        assert accessor['type'] == 'SCALAR' and accessor['componentType'] in (5123, 5125)
        view = document['bufferViews'][accessor['bufferView']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        code = 'H' if accessor['componentType'] == 5123 else 'I'
        assert not view.get('byteStride')
        entry['indices'].extend(struct.unpack_from('<' + str(accessor['count']) + code, binary, offset))
        before += accessor['count'] // 3
    primitives = []
    for entry in merged.values():
        indices = entry['indices']
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        code, component = ('H', 5123) if max(indices) < 65536 else ('I', 5125)
        packed = struct.pack('<' + str(len(indices)) + code, *indices)
        binary.extend(packed)
        view_index = len(document['bufferViews'])
        document['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(packed), 'target': 34963})
        accessor_index = len(document['accessors'])
        document['accessors'].append({'bufferView': view_index, 'componentType': component, 'count': len(indices), 'type': 'SCALAR', 'min': [min(indices)], 'max': [max(indices)]})
        primitive = copy.deepcopy(entry['source'])
        primitive['indices'] = accessor_index
        primitives.append(primitive)
        after += len(indices) // 3
    mesh['primitives'] = primitives
assert before == after == 7200
document['buffers'][0]['byteLength'] = len(binary)
document['asset']['extras'] = {'source': 'Microsoft Rocketbox Male_Adult_03', 'license': 'MIT', 'sourceCommit': '0943055db6ec570bcef9f2c8b41c9e5467c808f9'}
encoded = json.dumps(document, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
binary += b'\0' * (-len(binary) % 4)
output = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(encoded) + 8 + len(binary))
output += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
output += struct.pack('<II', len(binary), 0x004E4942) + binary
TARGET.mkdir(parents=True, exist_ok=True)
(TARGET / 'civilian-male.glb').write_bytes(output)
(TARGET / 'LICENSE.md').write_bytes((SOURCE / 'LICENSE.md').read_bytes())
manifest = json.loads((SOURCE / 'manifest.json').read_text())
manifest['assessment'] = 'Integrated as the game city-resident model through client/civilianCharacter.ts. Original MIT Rocketbox rig and source identity retained. Period authenticity unverified; does not replace player bonus characters.'
manifest['runtimeAsset'] = {'file': 'civilian-male.glb', 'bytes': len(output), 'sha256': hashlib.sha256(output).hexdigest(), 'triangles': after, 'skinBones': 80, 'materialPrimitives': sum(len(m['primitives']) for m in document['meshes']), 'maxTextureDimension': 1024, 'preparation': 'scripts/prepare-civilian.py merges material-equivalent index groups only; original skin, UVs, geometry and 1k textures preserved.'}
(TARGET / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest['runtimeAsset']))
