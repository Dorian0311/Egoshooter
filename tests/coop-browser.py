"""Two independent real browser clients avoid shared Chromium 123 SwiftShader stalls.
Rendering is throttled here; geometry and replay rendering use separate visual checks.
"""
import pathlib,json,time,re
from playwright.sync_api import sync_playwright
output=pathlib.Path('artifacts/operations-20261116');output.mkdir(parents=True,exist_ok=True);errors=[]
with sync_playwright() as p:
 browsers=[];pages=[]
 for name in ['Host','Peer']:
  browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader']);browsers.append(browser)
  context=browser.new_context(viewport={'width':900,'height':650},device_scale_factor=1)
  context.add_init_script("localStorage.setItem('altstadt.graphics.v3','performance'); window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),500); window.cancelAnimationFrame=clearTimeout;")
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:5173/',wait_until='networkidle');page.get_by_role('button',name='Verstanden · zur App',exact=True).click()
  page.get_by_label('Benutzername',exact=True).fill('CoopQA'+name+str(int(time.time()))[-6:]);page.get_by_label('Passwort',exact=True).fill('Local-only-Profile-4921');page.get_by_role('button',name='Profil anlegen & zur Lobby',exact=True).click();page.get_by_role('button',name='Einzelspieler & Koop',exact=False).wait_for(timeout=60000);pages.append(page)
 host,peer=pages
 lobby_background=host.locator('.city-lobby').evaluate('(el)=>getComputedStyle(el,"::before").backgroundImage');print('Lobby background',lobby_background,flush=True)
 assert 'encampment-v2.' in lobby_background,lobby_background
 host.get_by_role('button',name=re.compile('Alpen',re.I)).click();host.get_by_role('button',name='Einzelspieler & Koop',exact=False).click();host.get_by_label('Spielweise',exact=True).select_option('coop');host.get_by_label('Variante',exact=True).select_option('mission');host.get_by_label('Auftrag',exact=True).select_option('documents');host.get_by_label('Einsatzbedingungen',exact=True).select_option('night');host.get_by_role('button',name='Koop-Einsatz erstellen',exact=True).click();host.get_by_role('button',name='Karl Ruprecht Kroenen',exact=False).click();host.get_by_role('button',name='Mit dieser Figur starten',exact=True).click()
 host.locator('.city-panel .city-kicker').wait_for(timeout=60000);code=host.locator('.city-panel .city-kicker').inner_text().split()[-1]
 peer.get_by_label('Raum-Code',exact=True).fill(code);peer.get_by_role('button',name='Beitreten',exact=True).click();peer.locator('.character-picker header small').wait_for();map_label=peer.locator('.character-picker header small').inner_text();assert 'Alpen' in map_label,map_label
 peer.get_by_role('button',name='Mit dieser Figur starten',exact=True).click()
 for label,page in [('host',host),('peer',peer)]:
  button=page.get_by_role('button',name='Bereit für den Einsatz',exact=True)
  print('Readiness control',label,button.is_enabled(),flush=True)
  button.evaluate('(button)=>button.click()')
  print('Ready clicked',label,flush=True)
 for page in [host,peer]:page.get_by_text('Klicken zum Spielen',exact=False).wait_for(timeout=30000)
 host_hud=host.get_by_label('Einsatz und Vorräte',exact=True).inner_text();peer_hud=peer.get_by_label('Einsatz und Vorräte',exact=True).inner_text();assert 'KOOP' in host_hud and 'Dokumente' in host_hud and 'Nacht' in host_hud,host_hud;assert 'KOOP' in peer_hud
 peer.close()
 host.get_by_role('button',name='Einstellungen',exact=True).click();host.get_by_role('button',name='Einsatz verlassen · zur Lobby',exact=True).click();host.get_by_role('button',name='Einzelspieler & Koop',exact=False).click();host.get_by_label('Spielweise',exact=True).select_option('multiplayer');host.get_by_label('Einsatzbedingungen',exact=True).select_option('fog');assert 'Team-Deathmatch' in host.get_by_label('Variante',exact=True).inner_text();host.get_by_role('button',name='Mehrspieler-Einsatz erstellen',exact=True).click();host.get_by_role('button',name='Mit dieser Figur starten',exact=True).click();host.get_by_label('Einsatz und Vorräte',exact=True).wait_for();assert 'Mehrspieler' in host.get_by_label('Einsatz und Vorräte',exact=True).inner_text() and 'Nebel' in host.get_by_label('Einsatz und Vorräte',exact=True).inner_text()
 report={'coopCode':code,'lobbyVehicle':lobby_background,'joinedMap':map_label,'hostHUD':host_hud,'peerHUD':peer_hud,'multiplayerConditions':'fog selectable and synchronized','errors':errors};(output/'coop-browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report));[browser.close() for browser in browsers]
 if errors:raise SystemExit(1)
