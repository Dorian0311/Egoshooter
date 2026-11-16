"""Capture civilian clothing, gait and gesture from three views on local Vite."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

folder = Path('artifacts/movement-combat-20261116/civilian-quality')
folder.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'])
    page = browser.new_page(viewport={'width': 1000, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5173/tests/movement-review.html?character=de-field&civilian', wait_until='networkidle')
    page.wait_for_function("document.querySelector('#status').value.startsWith('Bereit')")
    for mode in ['idle', 'walk', 'taunt']:
        page.select_option('#motion', mode)
        page.wait_for_function("document.querySelector('#status').value.startsWith('Bereit')")
        page.wait_for_timeout(900)
        for view, angle in [('front', 0), ('quarter', .785398), ('side', 1.570796)]:
            page.evaluate('(angle)=>actorReview.setView(angle)', angle)
            page.wait_for_timeout(150)
            page.screenshot(path=str(folder / f'{mode}-{view}.png'))
    report = {'screenshots': 9, 'errors': errors, 'sample': page.evaluate('actorReview.sample()')}
    (folder / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    browser.close()
    print(json.dumps(report))
    assert not errors
