"""Prepare attributed German WWII meshes from public Objaverse mirrors.

Python dependencies: Pillow, numpy. Source files and API metadata stay in research/.
Preserves baked normals; converts legacy specular/gloss materials to glTF metal/rough.
"""
from pathlib import Path
from io import BytesIO
import gzip
import hashlib
import json
import struct
import urllib.request
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'research/german-weapon-upgrade'
TARGET = ROOT / 'public/shooter/models/realistic/german'
MODELS = {
    'stg44': 'fe139cf77b384d3fbf40bef53a6c809c',
    'gewehr43': '3a5fb9185b47408ba2bd6540e5771aec',
    'mg42': '325abbe1c6614dd58480db5557c4c7a2',
    'p38': '1ac10334fe70472880ec3f60a09d763a',
    'fg42': 'd699ac259bd74f70a51125a7e4320f4b',
}

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Egoshooter attributed asset preparation'})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()

def modification_description(name):
    changes = ['Runtime metre scale, forward orientation and grip alignment.']
    if name in ('gewehr43', 'p38'):
        changes.insert(0, 'Legacy specular/glossiness material maps converted to metallic/roughness.')
    else:
        changes.insert(0, 'Original embedded texture data retained.')
    if name == 'gewehr43':
        changes.append('Normal-map UV channel corrected to TEXCOORD_0.')
    if name == 'p38':
        changes.append('Exploded-view presentation extras removed.')
    return ' '.join(changes)

def linear(rgb):
    return np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)

def srgb(rgb):
    return np.where(rgb <= .0031308, rgb * 12.92, 1.055 * np.maximum(rgb, 0) ** (1 / 2.4) - .055)

def prepare(data, name):
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length])
    binary = data[28 + length:]
    images, original_images, changed_images = {}, {}, set()
    for index, entry in enumerate(doc.get('images', [])):
        view = doc['bufferViews'][entry['bufferView']]
        start = view.get('byteOffset', 0)
        block = binary[start:start + view['byteLength']]
        image = Image.open(BytesIO(block)).convert('RGBA')
        original_images[index] = block
        if max(image.size) > 2048:
            changed_images.add(index)
        image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        images[index] = image

    for material in doc.get('materials', []):
        spec = material.get('extensions', {}).pop('KHR_materials_pbrSpecularGlossiness', None)
        if not spec:
            continue
        diffuse = spec['diffuseTexture']['index']
        gloss = spec['specularGlossinessTexture']['index']
        di, si = doc['textures'][diffuse]['source'], doc['textures'][gloss]['source']
        diffuse_image = images[di]
        spec_image = images[si].resize(diffuse_image.size, Image.Resampling.LANCZOS)
        d = np.asarray(diffuse_image, dtype=np.float32) / 255
        s = np.asarray(spec_image, dtype=np.float32) / 255
        dc = linear(d[..., :3]) * np.array(spec.get('diffuseFactor', [1, 1, 1, 1])[:3])
        sc = linear(s[..., :3]) * np.array(spec.get('specularFactor', [1, 1, 1]))
        strength = np.max(sc, axis=-1)
        brightness = lambda c: np.sqrt(np.sum(c * c * [.299, .587, .114], axis=-1))
        b = brightness(dc) * (1 - strength) / .96 + brightness(sc) - .08
        c = .04 - brightness(sc)
        metallic = np.clip((-b + np.sqrt(np.maximum(0, b * b - .16 * c))) / .08, 0, 1)
        metallic = np.where(brightness(sc) < .04, 0, metallic)
        base_diffuse = dc * ((1 - strength) / .96 / np.maximum(1 - metallic, 1e-6))[..., None]
        base_specular = (sc - .04 * (1 - metallic)[..., None]) / np.maximum(metallic[..., None], 1e-6)
        base = base_diffuse * (1 - metallic[..., None] ** 2) + base_specular * metallic[..., None] ** 2
        rgba = np.dstack((srgb(np.clip(base, 0, 1)), d[..., 3]))
        images[di] = Image.fromarray(np.uint8(np.clip(rgba, 0, 1) * 255), 'RGBA')
        mr = np.zeros_like(d)
        mr[..., 0] = mr[..., 3] = 1
        mr[..., 1] = 1 - s[..., 3] * spec.get('glossinessFactor', 1)
        mr[..., 2] = metallic
        images[si] = Image.fromarray(np.uint8(np.clip(mr, 0, 1) * 255), 'RGBA')
        changed_images.update([di, si])
        material['pbrMetallicRoughness'] = {'baseColorTexture': {'index': diffuse}, 'metallicRoughnessTexture': {'index': gloss}}
    for key in ['extensionsUsed', 'extensionsRequired']:
        if key in doc:
            doc[key] = [value for value in doc[key] if value != 'KHR_materials_pbrSpecularGlossiness']
            if not doc[key]:
                del doc[key]

    if name == 'p38':
        # The source is an exploded presentation with spare magazines and a cartridge.
        for node in doc.get('nodes', []):
            if 'mesh' in node and not node.get('name', '').startswith('P38_Mesh'):
                del node['mesh']
    if name == 'gewehr43':
        # This single source mesh only provides TEXCOORD_0.
        for material in doc.get('materials', []):
            if 'normalTexture' in material:
                material['normalTexture']['texCoord'] = 0

    encoded_images = {}
    for index, image in images.items():
        if index not in changed_images:
            encoded_images[doc['images'][index]['bufferView']] = original_images[index]
            continue
        stream = BytesIO()
        image.save(stream, format='PNG', optimize=True)
        encoded_images[doc['images'][index]['bufferView']] = stream.getvalue()
        doc['images'][index]['mimeType'] = 'image/png'
    output = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        start = view.get('byteOffset', 0)
        block = encoded_images.get(index, binary[start:start + view['byteLength']])
        output.extend(b'\0' * (-len(output) % 4))
        view['byteOffset'], view['byteLength'] = len(output), len(block)
        output.extend(block)
    doc['buffers'] = [{'byteLength': len(output)}]
    header = json.dumps(doc, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    output.extend(b'\0' * (-len(output) % 4))
    return (struct.pack('<4sII', b'glTF', 2, 28 + len(header) + len(output))
            + struct.pack('<I4s', len(header), b'JSON') + header
            + struct.pack('<I4s', len(output), b'BIN\0') + output)

if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    TARGET.mkdir(parents=True, exist_ok=True)
    catalog = CACHE / 'object-paths.json.gz'
    if not catalog.exists():
        catalog.write_bytes(fetch('https://huggingface.co/datasets/allenai/objaverse/resolve/main/object-paths.json.gz'))
    paths = json.loads(gzip.decompress(catalog.read_bytes()))
    records = []
    for name, uid in MODELS.items():
        metadata = json.loads(fetch('https://api.sketchfab.com/v3/models/' + uid))
        if metadata.get('license', {}).get('slug') != 'by':
            raise ValueError('Expected CC BY license: ' + name)
        (CACHE / (uid + '.json')).write_text(json.dumps(metadata), encoding='utf-8')
        source = CACHE / (name + '.glb')
        url = 'https://huggingface.co/datasets/allenai/objaverse/resolve/main/' + paths[uid]
        if not source.exists():
            source.write_bytes(fetch(url))
        data = source.read_bytes()
        packed = prepare(data, name)
        (TARGET / (name + '.glb')).write_bytes(packed)
        records.append({'file': name + '.glb', 'uid': uid, 'title': metadata['name'], 'author': metadata['user']['displayName'],
                        'source': metadata['viewerUrl'], 'mirror': url, 'license': 'CC-BY-4.0',
                        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
                        'sourceSha256': hashlib.sha256(data).hexdigest(), 'sha256': hashlib.sha256(packed).hexdigest(),
                        'bytes': len(packed), 'modifications': modification_description(name)})
        print(f'{name}: {len(data)} -> {len(packed)} bytes', flush=True)
    (TARGET / 'provenance.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    credits = ['German WWII weapon models', '', 'All imported models: CC BY 4.0.', 'https://creativecommons.org/licenses/by/4.0/', '']
    for record in records:
        credits.extend([record['title'] + ' - ' + record['author'], record['source'], 'Changes: ' + record['modifications'], ''])
    (TARGET / 'CREDITS.txt').write_text('\n'.join(credits), encoding='utf-8')
    main_credits = TARGET.parent / 'CREDITS.txt'
    if main_credits.exists():
        marker = '\n# Detailed German WWII additions\n'
        prefix = main_credits.read_text(encoding='utf-8').split(marker)[0].rstrip()
        main_credits.write_text(prefix + marker + '\n' + '\n'.join(credits), encoding='utf-8')
