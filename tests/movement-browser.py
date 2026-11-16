"""Visual and numeric checks of all actor rigs under actual WebGL rendering."""
import pathlib,json,sys
from playwright.sync_api import sync_playwright
out=pathlib.Path('artifacts/movement-combat-20261116');out.mkdir(parents=True,exist_ok=True)
errors=[];report=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':960,'height':720},device_scale_factor=1);page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto('http://127.0.0.1:5173/tests/movement-review.html',wait_until='networkidle')
 ids=page.get_by_label('Figur',exact=True).locator('option').evaluate_all('(options)=>options.map(o=>o.value)')
 for id in sys.argv[1:] or ids:
  page.get_by_label('Figur',exact=True).select_option(id);page.wait_for_function('(id)=>document.querySelector("#status").value===`Bereit · ${id}`',arg=id)
  page.get_by_label('Bewegung',exact=True).select_option('walk');page.wait_for_timeout(700);page.evaluate('actorReview.resetTimings()');page.wait_for_timeout(700);first=page.evaluate('actorReview.sample()');page.wait_for_timeout(220);second=page.evaluate('actorReview.sample()')
  delta=sum(abs(a-b) for a,b in zip(first.get('left',[]),second.get('left',[])))+sum(abs(a-b) for a,b in zip(first.get('right',[]),second.get('right',[])))
  page.screenshot(path=str(out/(id+'-walk.png')),timeout=60000)
  page.get_by_label('Bewegung',exact=True).select_option('sprint');page.wait_for_timeout(400);sprint=page.evaluate('actorReview.sample()')
  parts={}
  for part in ['armL','armR','legL','legR','head']:
   page.get_by_label('Körperteil',exact=True).select_option(part);page.get_by_role('button',name='Abtrennen',exact=True).click();parts[part]=page.evaluate('actorReview.sample().lastPartVertices');page.get_by_role('button',name='Wiederherstellen',exact=True).click()
  entry={'figure':id,'legMotion':delta,'walk':second,'sprint':sprint,'parts':parts};report.append(entry);print(json.dumps(entry),flush=True)
  assert delta>.0001,(id,'no leg motion');assert all(count>0 for count in parts.values()),(id,'missing limb geometry',parts)
  if id!='leatherface':assert second['held'] and len(second['gripErrors'])==2,(id,'missing weapon or arm chain')
 page.get_by_label('Figur',exact=True).select_option('de-field');page.get_by_label('Bewegung',exact=True).select_option('taunt');page.wait_for_function('document.querySelector("#status").value==="Bereit · de-field"');page.wait_for_timeout(700);page.screenshot(path=str(out/'npc-gesture.png'),timeout=60000);gesture=page.evaluate('actorReview.sample()');assert not gesture['held'];assert gesture.get('finger') and gesture.get('middle')
 browser.close()
(out/'report.json').write_text(json.dumps({'figures':report,'gesture':gesture,'errors':errors},indent=2),encoding='utf-8')
if errors:raise SystemExit(1)
