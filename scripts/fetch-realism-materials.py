"""Fetch only the CC0 rock set used by the realism update; verify source hashes."""
import json
import runpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
material = runpy.run_path(str(root / 'scripts/fetch-art-assets.py'))['material']
for name in ['rock_01', 'plastered_wall_05']:
    record = material(name)
    (root / f'public/shooter/materials/{name}/provenance.json').write_text(
        json.dumps(record, indent=2) + '\n', encoding='utf-8')
    print(f'Verified {name}:', sum(file['bytes'] for file in record['files']), 'bytes')
