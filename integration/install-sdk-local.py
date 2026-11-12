"""Copy a tested SDK with private nested dependencies when cloud folders reject npm.

Only creates a new node_modules/@colyseus/sdk directory, never replaces packages.
The tracked package.json/lock still use the normal npm registry dependency.
"""
from pathlib import Path
import json
import shutil
import sys

source = Path(sys.argv[1]).resolve() / 'node_modules'
target = Path(sys.argv[2]).resolve() / 'node_modules/@colyseus/sdk'
if target.exists():
    raise SystemExit('SDK already exists; nothing replaced')
sdk = source / '@colyseus/sdk'
if not (sdk / 'package.json').is_file():
    raise SystemExit('Tested SDK missing')
packages = {}
queue = [sdk]
while queue:
    package = queue.pop()
    manifest = json.loads((package / 'package.json').read_text(encoding='utf-8'))
    name = manifest['name']
    if name in packages:
        continue
    packages[name] = package
    for dependency in manifest.get('dependencies', {}):
        nested = package / 'node_modules' / dependency
        candidate = nested if nested.exists() else source / dependency
        if not (candidate / 'package.json').is_file():
            raise SystemExit(f'Missing dependency: {dependency}')
        queue.append(candidate)
shutil.copytree(sdk, target, ignore=shutil.ignore_patterns('node_modules'))
for name, package in packages.items():
    if name == '@colyseus/sdk':
        continue
    shutil.copytree(package, target / 'node_modules' / name,
                    ignore=shutil.ignore_patterns('node_modules'))
print(f'Installed SDK plus {len(packages)-1} private dependencies; no existing packages replaced')
