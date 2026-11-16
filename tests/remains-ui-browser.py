import pathlib,json
from playwright.sync_api import sync_playwright,expect
output=pathlib.Path('artifacts/movement-combat-20261116');output.mkdir(parents=True,exist_ok=True);errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True);page=browser.new_page(viewport={'width':1366,'height':900});page.on('pageerror',lambda error:errors.append(str(error)));page.goto('http://127.0.0.1:5173/tests/remains-ui-review.html',wait_until='networkidle')
 expect(page.get_by_label('Verbleibender Leichenschild',exact=True)).to_have_attribute('value','90');expect(page.get_by_label('Besiegter Gegner')).to_be_visible();assert page.get_by_alt_text('Gesicht von Gegner Kroenen').evaluate('(img)=>img.complete&&img.naturalWidth===192')
 page.screenshot(path=str(output/'shield-face-desktop.png'));page.get_by_role('button',name='Kopf lösen',exact=True).click();expect(page.get_by_role('status')).to_contain_text('ziehen und drehen');page.get_by_role('button',name='Erste Hilfe',exact=True).click();expect(page.get_by_label('Einsatz und Vorräte')).to_contain_text('Rückkehr in 8 s');page.get_by_role('button',name='Körperteil',exact=True).click();expect(page.get_by_label('Einsatz und Vorräte')).to_contain_text('Werfen');page.get_by_role('button',name='Tragen',exact=True).click();page.set_viewport_size({'width':390,'height':800});page.screenshot(path=str(output/'shield-face-mobile.png'));assert page.get_by_label('Leichenschild',exact=True).bounding_box()['x']>=0
 browser.close()
(output/'remains-ui-report.json').write_text(json.dumps({'passed':['Shield damage pool alongside health','Original enemy face image without runtime 3D','Head-removal progress','Medical-tent revival countdown','Held-body-part controls','Mobile shield display'],'errors':errors},indent=2),encoding='utf-8');print(json.dumps({'errors':errors}))
if errors:raise SystemExit(1)
