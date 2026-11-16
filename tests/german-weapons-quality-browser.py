"""Visual QA of the actual imported weapons and the production viewmodel loader."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

output = Path('artifacts/german-weapon-quality-20261116')
output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1480,'height':1250})
    errors, warnings = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda message: warnings.append(message.text) if message.type == 'warning' else None)
    page.goto('http://127.0.0.1:5173/tests/german-weapons-review.html', wait_until='domcontentloaded')
    page.wait_for_selector('body[data-ready=true]', timeout=90000)
    models = page.evaluate('germanWeaponReview')
    assert len(models) == 6 and sum(m['imported'] for m in models) == 5
    assert all(m['textures'] >= 3 for m in models if m['imported'])
    assert all(m['triangles'] > 2500 for m in models)
    page.screenshot(path=str(output/'new-german-models.png'), full_page=True)
    print('Model overview verified', flush=True)
    page.goto('http://127.0.0.1:5173/tests/german-weapons-fps.html', wait_until='domcontentloaded')
    page.wait_for_selector('body[data-ready=true]', timeout=120000)
    fps = page.evaluate('germanWeaponFps')
    assert len(fps) == 6 and all(m['finite'] for m in fps)
    page.screenshot(path=str(output/'new-first-person.png'), full_page=True)
    report = {'models':models,'firstPerson':fps,'errors':errors,'warnings':warnings}
    (output/'quality-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({'models':6,'firstPerson':6,'errors':errors,'warnings':warnings}))
    browser.close()
    assert not errors and not warnings
