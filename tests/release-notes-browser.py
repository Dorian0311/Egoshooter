"""Verify one-time release notes with real browser storage, reload and login."""
import json,os,pathlib,time
from playwright.sync_api import sync_playwright,expect

output=pathlib.Path('artifacts/operations-20261116');output.mkdir(parents=True,exist_ok=True)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel=os.getenv("PLAYWRIGHT_CHANNEL"))
 context=browser.new_context(viewport={'width':1366,'height':900})
 context.add_init_script("if(!localStorage.getItem('eiserne-front-changelog'))localStorage.setItem('eiserne-front-changelog','island-zeitreise-grafik-2026-11-25')")
 page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
 dialog=page.get_by_role('dialog',name='Neu in Eiserne Front',exact=True)
 expect(dialog).to_be_visible();assert dialog.locator('.release-notes-content section').count()==11
 for heading in ['Island und Zeitreise','Begehbare Harbour Road','Post vom Hafenamt','Historische Architektur','Union-Lichtspiele','Flüssigeres Umsehen']:
  expect(dialog.get_by_role('heading',name=heading,exact=True)).to_have_count(1)
 page.screenshot(path=str(output/'changelog-desktop.png'))
 page.get_by_role('button',name='Verstanden · zur App',exact=True).click();expect(dialog).to_have_count(0)
 assert page.evaluate("localStorage.getItem('eiserne-front-changelog')")=='island-zeitreise-grafik-2026-11-26'
 page.reload(wait_until='networkidle');expect(dialog).to_have_count(0)
 page.get_by_label('Benutzername',exact=True).fill('ChangelogQA'+str(int(time.time()))[-7:])
 page.get_by_label('Passwort',exact=True).fill('Local-only-Changelog-4921')
 page.get_by_role('button',name='Profil anlegen & zur Lobby',exact=True).click()
 page.get_by_role('button',name='Einzelspieler & Koop',exact=False).wait_for(timeout=60000)
 expect(dialog).to_have_count(0)
 mobile=browser.new_context(viewport={'width':390,'height':700});phone=mobile.new_page()
 phone.on('pageerror',lambda error:errors.append(str(error)))
 phone.goto('http://127.0.0.1:5173/',wait_until='networkidle')
 mobile_dialog=phone.get_by_role('dialog',name='Neu in Eiserne Front',exact=True);expect(mobile_dialog).to_be_visible()
 bounds=mobile_dialog.bounding_box();assert bounds and bounds['x']>=0 and bounds['x']+bounds['width']<=390 and bounds['height']<=630
 assert mobile_dialog.locator('.release-notes-content').evaluate('(el)=>el.scrollHeight>el.clientHeight')
 phone.screenshot(path=str(output/'changelog-mobile.png'))
 phone.keyboard.press('Escape');expect(mobile_dialog).to_have_count(0)
 phone.reload(wait_until='networkidle');expect(mobile_dialog).to_have_count(0)
 report={'passed':['First start shows all eleven change groups','Acknowledgement persists across reload','Login does not reopen acknowledged release notes','Fresh browser profile sees release notes','Mobile dialog fits viewport with scrollable changes','Escape acknowledges the update'],'errors':errors}
 (output/'changelog-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps(report));browser.close()
 if errors:raise SystemExit(1)
