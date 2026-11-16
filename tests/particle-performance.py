"""Compare real GPU draw submissions with the pre-batching revision (Vite on 5173)."""
from pathlib import Path
import json, subprocess
from playwright.sync_api import sync_playwright

out=Path('artifacts/movement-combat-20261116');out.mkdir(parents=True,exist_ok=True)
baseline=subprocess.run(['git','show','775d9f8:client/hitEffects.ts'],check=True,capture_output=True).stdout
(out/'baseline-hit-effects.ts').write_bytes(baseline)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':960,'height':720});page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
 page.goto('http://127.0.0.1:5173/tests/particle-performance.html',wait_until='networkidle')
 before=page.evaluate('particleReview.burst(true)');after=page.evaluate('particleReview.burst(false)')
 page.screenshot(path=str(out/'particle-batched.png'))
 assert after['drawCalls']<=3 and before['drawCalls']>after['drawCalls'],(before,after)
 report={'before':before,'after':after,'errors':errors,'limits':'Software WebGL; CPU timing includes shader compilation and is not physical-hardware FPS.'}
 (out/'particle-gpu-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps(report));browser.close()
 if errors:raise SystemExit(1)
