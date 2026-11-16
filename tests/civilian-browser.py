"""Inspect the runtime civilian from three views, exercise injuries and restoration."""
import json
import hashlib
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

folder = Path('artifacts/movement-combat-20261116/civilian-quality')
folder.mkdir(parents=True, exist_ok=True)
# Keep one reviewed code snapshot even while other agents continue source edits.
subprocess.run(['node', '--input-type=module', '-e', "import {build} from 'esbuild'; await build({entryPoints:['tests/movement-review.ts'],outfile:'artifacts/civilian-review-stable.js',bundle:true,format:'esm',target:'es2022'});"], check=True)
html = Path('tests/movement-review.html').read_text(encoding='utf-8').replace('/tests/movement-review.ts', '/artifacts/civilian-review-stable.js')
Path('artifacts/civilian-review-stable.html').write_text(html, encoding='utf-8')
fixture_url = 'http://127.0.0.1:5173/artifacts/civilian-review-stable.html'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'])
    page = browser.new_page(viewport={'width': 1000, 'height': 1000})
    page.route('**/@vite/client', lambda route: route.fulfill(status=200, content_type='application/javascript', body=''))
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{fixture_url}?character=de-field&civilian', wait_until='networkidle')
    page.wait_for_function("document.querySelector('#status').value.startsWith('Bereit')")
    source = page.evaluate('actorReview.root().userData.civilianSource??null')
    assert source == 'Microsoft Rocketbox Male_Adult_03', f'Unexpected civilian fallback: {source}'
    for mode in ['idle', 'walk', 'taunt']:
        page.select_option('#motion', mode)
        page.wait_for_function("document.querySelector('#status').value.startsWith('Bereit')")
        page.wait_for_timeout(900)
        for view, angle in [('front', 0), ('quarter', .785398), ('side', 1.570796)]:
            page.evaluate('(angle)=>actorReview.setView(angle)', angle)
            page.wait_for_timeout(150)
            page.screenshot(path=str(folder / f'{mode}-{view}.png'))
    page.select_option('#motion', 'idle')
    page.wait_for_function("document.querySelector('#status').value.startsWith('Bereit')")
    page.wait_for_timeout(200)
    topology = '''()=>{const result=[];actorReview.root().traverse(o=>{if(o.isSkinnedMesh){const index=o.geometry.index?.array;result.push({name:o.name,vertices:o.geometry.getAttribute('position').count,indices:index?.length??0,checksum:index?Array.from(index).reduce((sum,n)=>sum+n,0):0});}});return result;}'''
    initial = page.evaluate(topology)
    checks = []
    for part in ['armL', 'armR', 'legL', 'legR', 'head']:
        # Inspect the real cut proportions before the fixture's impulse carries it
        # close to the camera and exaggerates the apparent wound size.
        page.evaluate('''()=>{window.qaRaf=requestAnimationFrame;window.qaPending=null;window.requestAnimationFrame=callback=>{window.qaPending=callback;return 0;};}''')
        page.select_option('#limb', part)
        page.click('#detach')
        page.evaluate('''()=>{if(window.qaPending)window.qaPending(performance.now());}''')
        page.wait_for_timeout(150)
        assert page.evaluate('actorReview.sample().lastPartVertices') > 30, f'{part} detached empty geometry'
        assert page.evaluate(topology) != initial, f'{part} left the original mesh unchanged'
        page.screenshot(path=str(folder / f'detached-{part}.png'))
        page.click('#restore')
        page.evaluate('''()=>{const frame=window.qaPending;window.requestAnimationFrame=window.qaRaf;if(frame)requestAnimationFrame(frame);}''')
        page.wait_for_timeout(100)
        assert page.evaluate(topology) == initial, f'{part} restoration changed the original topology'
        checks.append(f'{part}: original geometry detached and fully restored')
    page.screenshot(path=str(folder / 'fully-restored.png'))
    civilian_sample = page.evaluate('actorReview.sample()')
    bonus = {}
    for character in ['kroenen', 'deadpool']:
        page.goto(f'{fixture_url}?character={character}', wait_until='networkidle')
        page.wait_for_function("document.querySelector('#status').value.startsWith('Bereit')")
        assert page.evaluate('actorReview.root().userData.civilianSource??null') is None
        page.select_option('#motion', 'walk')
        page.wait_for_timeout(250)
        before = page.evaluate('actorReview.sample()')
        page.wait_for_timeout(300)
        after = page.evaluate('actorReview.sample()')
        assert before['left'] != after['left'], f'{character} leg no longer animates'
        assert after['held'], f'{character} weapon missing'
        assert not after['gripErrors'] or max(after['gripErrors']) < .04, f'{character} weapon grip regressed'
        page.screenshot(path=str(folder / f'{character}-walk-regression.png'))
        bonus[character] = after
    report = {'screenshots': 17, 'source': source, 'checks': checks, 'errors': errors, 'sample': civilian_sample, 'bonus': bonus, 'fixtureSha256': hashlib.sha256(Path('artifacts/civilian-review-stable.js').read_bytes()).hexdigest(), 'modelSha256': hashlib.sha256(Path('public/shooter/characters/civilian/civilian-male.glb').read_bytes()).hexdigest()}
    (folder / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    browser.close()
    print(json.dumps(report))
    assert not errors
