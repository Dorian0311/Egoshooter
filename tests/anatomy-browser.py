import pathlib,json,sys
from playwright.sync_api import sync_playwright
output=pathlib.Path('artifacts/operations-20261116/figures');output.mkdir(parents=True,exist_ok=True)
errors=[];checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':960,'height':640},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/tests/anatomy-review.html',wait_until='networkidle')
 ids=page.get_by_label('Figur',exact=True).locator('option').evaluate_all('(options)=>options.map(o=>o.value)')
 for id in (sys.argv[1:] or ids):
  page.get_by_label('Figur',exact=True).select_option(id)
  page.wait_for_function('(id)=>document.querySelector("#status").value===`Bereit · ${id}`',arg=id,timeout=30000)
  page.wait_for_timeout(350);page.screenshot(path=str(output/(id+'-intact.png')),timeout=60000)
  page.get_by_role('button',name='Arm abtrennen').click();page.get_by_role('button',name='Bein abtrennen').click()
  page.wait_for_timeout(300);page.screenshot(path=str(output/(id+'-injured.png')),timeout=60000)
  assert 'Maske 18' in page.locator('#status').inner_text()
  page.get_by_role('button',name='Wiederherstellen').click();assert 'Maske' not in page.locator('#status').inner_text()
  checks.append(id)
 browser.close()
old=json.loads((output/'report.json').read_text()) if (output/'report.json').exists() else {'figures':[]}
report={'figures':sorted(set(old['figures'])|set(checks)),'latestFigures':checks,'errors':errors};(output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
if errors:raise SystemExit(1)
