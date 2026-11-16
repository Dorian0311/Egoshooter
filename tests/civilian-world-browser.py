from pathlib import Path
import json
from playwright.sync_api import sync_playwright
out=Path('artifacts/civilian-integration');out.mkdir(parents=True,exist_ok=True)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1100,'height':800});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/tests/civilian-world-review.html',wait_until='networkidle')
 page.wait_for_function('window.civilianWorld');page.wait_for_timeout(8000)
 page.screenshot(path=str(out/'npc-kroenen-deadpool-world.png'),timeout=60000)
 page.evaluate('civilianWorld.gesture(true)');page.wait_for_timeout(1200)
 page.screenshot(path=str(out/'npc-gesture-world.png'),timeout=60000)
 report={'errors':errors,'stats':page.evaluate('civilianWorld.stats()')};(out/'world-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report));browser.close()
 assert not errors
