"""Attach capped-resolution source textures to offline-converted character GLBs."""
import hashlib
import io
import json
import pathlib
import re
import struct
from PIL import Image

def key(name):
    return re.sub(r'[^a-z0-9]', '', pathlib.Path(name.replace('\\', '/')).name.lower())

for name in ['deadpool', 'harley', 'rocket', 'homer']:
    folder = pathlib.Path('research/playable-characters') / name
    raw = (folder / 'untextured.glb').read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    binary = bytearray(raw[28 + size:])
    materials = json.loads((folder / 'materials.json').read_text())
    images = {key(p.name): p for p in folder.iterdir() if p.suffix.lower() in ['.png', '.jpg']}
    doc['images'] = []
    doc['textures'] = []
    texture_ids = {}
    for material in doc['materials']:
        file = materials[material['name']].get('albedo')
        if not file:
            continue
        image = images.get(key(file))
        if image is None:
            raise ValueError(f'Missing texture {name}: {file}')
        if image not in texture_ids:
            img = Image.open(image).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            transparent = img.getextrema()[3][0] < 255
            png = transparent or max(img.size) <= 256
            stream = io.BytesIO()
            if png:
                img.save(stream, format='PNG', optimize=True)
            else:
                img.convert('RGB').save(stream, format='JPEG', quality=88)
            while len(binary) % 4:
                binary.append(0)
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(stream.getvalue())})
            binary.extend(stream.getvalue())
            doc['images'].append({'bufferView': len(doc['bufferViews']) - 1, 'mimeType': 'image/png' if png else 'image/jpeg'})
            doc['textures'].append({'source': len(doc['images']) - 1})
            texture_ids[image] = (len(doc['textures']) - 1, transparent)
        index, transparent = texture_ids[image]
        material['pbrMetallicRoughness']['baseColorTexture'] = {'index': index}
        material['pbrMetallicRoughness']['baseColorFactor'] = [1, 1, 1, 1]
        if transparent:
            material.update(alphaMode='MASK', alphaCutoff=.4, doubleSided=True)
    while len(binary) % 4:
        binary.append(0)
    doc['buffers'][0]['byteLength'] = len(binary)
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    packed = struct.pack('<III', 0x46546c67, 2, 28 + len(data) + len(binary))
    packed += struct.pack('<II', len(data), 0x4e4f534a) + data
    packed += struct.pack('<II', len(binary), 0x004e4942) + binary
    target = pathlib.Path('public/shooter/characters/bonus') / (name + '.glb')
    target.write_bytes(packed)
    report = json.loads((folder / 'conversion.json').read_text())
    report.update(bytes=len(packed), sha256=hashlib.sha256(packed).hexdigest(), maxTextureSize=1024,
                  source='User-provided archive; not a verified redistribution license',
                  animation='Source skinning retained; gameplay animation is procedural. No downloaded scripts executed.')
    target.with_suffix('.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(name, len(packed), 'bytes', len(doc['textures']), 'textures')
