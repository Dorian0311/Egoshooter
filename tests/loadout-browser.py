"""Local preview QA: character, exactly five weapons, slots and mobile layout."""
import json, base64, hashlib, hmac, time
from pathlib import Path
from playwright.sync_api import sync_playwright

output = Path('artifacts/weapon-loadout-20261116')
output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("localStorage.setItem('altstadt.graphics.v3','performance');localStorage.setItem('eiserne-front-changelog','remains-2026-11-16');localStorage.removeItem('altstadt-loadout');")
    def ticket(route):
        encode=lambda value:base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
        body=encode({'alg':'HS256'})+b'.'+encode({'iss':'supporthub','aud':'altstadt-1940','sub':'loadout-qa','name':'Loadout QA','role':'Support.Agent','iat':int(time.time()),'exp':int(time.time())+3600})
        token=(body+b'.'+base64.urlsafe_b64encode(hmac.new(b'local-browser-preview-secret-32-chars-only',body,hashlib.sha256).digest()).rstrip(b'=')).decode()
        route.fulfill(json={'ticket':token,'serverUrl':'http://127.0.0.1:2580','playerId':'loadout-qa'})
    page.route('**/api/shooter/ticket',ticket)
    page.goto('http://127.0.0.1:5173/tests/loadout-review.html', wait_until='domcontentloaded', timeout=60000)
    print('Lobby loaded',flush=True)
    if page.get_by_role('button',name='Verstanden · zur App',exact=True).is_visible():page.get_by_role('button',name='Verstanden · zur App',exact=True).click()
    page.get_by_role('button', name='Einzelspieler & Koop', exact=False).click(timeout=60000)
    page.get_by_role('button', name='Charakter wählen & starten', exact=True).click()
    page.get_by_role('button', name='Weiter zur Waffenauswahl', exact=True).wait_for()
    assert page.locator('.weapon-picker').count() == 0
    page.screenshot(path=str(output / '01-character.png'))
    page.get_by_role('button', name='Weiter zur Waffenauswahl', exact=True).click()
    start = page.get_by_role('button', name='Mit diesen 5 Waffen starten', exact=False)
    assert start.is_disabled()
    for weapon in ['StG 44', 'Gewehr 43', 'MG 42', 'MP 34']:
        page.locator('.weapon-catalog button').filter(has=page.get_by_text(weapon, exact=True)).click()
    assert start.is_disabled()
    page.locator('.weapon-catalog button').filter(has=page.get_by_text('Walther P38', exact=True)).click()
    assert start.is_enabled()
    assert page.locator('.weapon-catalog button[aria-pressed=true]').count() == 5
    assert page.locator('.weapon-catalog button[aria-pressed=false]').first.is_disabled()
    page.screenshot(path=str(output / '02-five-weapons.png'))
    print('Five-weapon validation passed',flush=True)
    page.set_viewport_size({'width':390,'height':844})
    assert page.locator('.weapon-picker').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
    page.screenshot(path=str(output / '03-mobile.png'))
    page.set_viewport_size({'width':1280,'height':900})
    start.click()
    page.locator('.loadout-hud').wait_for(timeout=90000)
    print('Live match started',flush=True)
    assert page.locator('.loadout-hud li').all_text_contents() == ['1StG 44','2Gewehr 43','3MG 42','4MP 34','5Walther P38']
    page.locator('.city-canvas').evaluate('(canvas)=>{canvas.requestPointerLock=()=>Promise.reject(new Error("Headless drag-look fallback"));}')
    page.locator('.city-canvas').click(position={'x':600,'y':450}, force=True)
    page.wait_for_timeout(1000)
    print('Input focus',page.evaluate('document.activeElement?.className'),flush=True)
    for slot, name in [(2,'Gewehr 43'), (3,'MG 42'), (4,'MP 34'), (5,'Walther P38'), (1,'StG 44')]:
        print('Selecting slot',slot,name,flush=True)
        page.keyboard.press(str(slot))
        try:page.wait_for_function('(name)=>document.querySelector(".loadout-hud .equipped span")?.textContent===name', arg=name, timeout=15000)
        except Exception:
            print('Input failure',page.locator('.loadout-hud').inner_text(),errors,flush=True)
            page.screenshot(path=str(output/'input-failure.png'))
            raise
    page.keyboard.press('Escape')
    page.screenshot(path=str(output / '04-in-game.png'))
    page.goto('http://127.0.0.1:5173/tests/german-weapons-review.html', wait_until='domcontentloaded')
    page.wait_for_selector('body[data-ready=true]')
    page.screenshot(path=str(output / '05-german-models.png'), full_page=True)
    report = {'selectionOrder':'character → five weapons → game','selected':['StG 44','Gewehr 43','MG 42','MP 34','Walther P38'],'slots':'1–5 verified','mobileOverflow':False,'errors':errors}
    (output/'browser-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True))
    browser.close()
    assert not errors, errors
