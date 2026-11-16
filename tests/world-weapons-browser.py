"""Inspect the actual cached textured guns on actor hands in WebGL."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
out=Path('artifacts/remains-client/world-weapons');out.mkdir(parents=True,exist_ok=True)
errors=[];results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1100,'height':850});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/tests/movement-review.html?character=deadpool',wait_until='networkidle');page.wait_for_function('actorReview.root()')
 page.evaluate('actorReview.setView(-.9)')
 for weapon,name in [('0','kar98k'),('1','luger'),('2','mp40'),('3','g36')]:
  page.get_by_label('Waffe',exact=True).select_option(weapon)
  page.wait_for_function('(name)=>!!window.actorReview?.root()?.getObjectByName(`world-${name}`)',arg=name,timeout=60000)
  page.wait_for_timeout(300);sample=page.evaluate('actorReview.sample()');assert max(sample['gripErrors'])<.01
  page.screenshot(path=str(out/(name+'.png')),timeout=60000);results.append({'weapon':name,'gripErrors':sample['gripErrors'],'drawCalls':sample['drawCalls']})
 browser.close()
report={'weapons':results,'errors':errors};(out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
if errors:raise SystemExit(1)
