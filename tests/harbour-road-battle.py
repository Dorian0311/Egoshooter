"""Walk the normal Island battle client through Harbour Road using keyboard and mouse input."""
import json
import math
import os
import re
import time
from pathlib import Path
from playwright.sync_api import sync_playwright


BASE = 'http://127.0.0.1:5173'
OUT = Path('artifacts/harbour-battle')
OUT.mkdir(parents=True, exist_ok=True)


def observe(route):
    # Add read-only probes to the local Vite response, leaving gameplay and frame scheduling intact.
    response = route.fetch()
    source, count = re.subn(r'(scene\.current\?\.update\(s, (\w+)\.playerId\);)',
        r'\1 window.harbourQA={player:own,state:s,scene:scene.current};', response.text())
    assert count == 1, 'Snapshot observation point changed'
    route.fulfill(response=response, body=source)


def walk(page, x, z):
    deadline = time.monotonic() + 45
    previous = None
    try:
        while time.monotonic() < deadline:
            px, pz, yaw, hp = page.evaluate('()=>{const p=harbourQA.player;return [p.x,p.z,p.yaw,p.hp]}')
            assert hp > 0, ('Player fell', px, pz)
            distance = math.hypot(px-x, pz-z)
            if distance < .60:
                return
            target = math.atan2(px-x, pz-z)
            if previous is None or abs(math.remainder(target-previous, math.tau)) > .02:
                delta = math.remainder(target-(yaw if previous is None else previous), math.tau)
                mouse(page, -round(delta/.002))
                previous = target
            if hp<65:
                page.keyboard.press('h')
            if distance>4:
                page.keyboard.down('Shift')
            else:
                page.keyboard.up('Shift')
            page.keyboard.down('w')
            page.wait_for_timeout(60)
        raise AssertionError(('Waypoint blocked', x, z, px, pz))
    finally:
        page.keyboard.up('Shift')
        page.keyboard.up('w')
        page.wait_for_timeout(220)


def mouse(page, dx):
    page.evaluate("dx=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,bubbles:true}))", dx)


def measure(page, name):
    page.evaluate('harbourQA.scene.profileFrames(3000)')
    start = page.evaluate('harbourQA.player.yaw')
    for n in range(12):
        for _ in range(6):
            mouse(page, (1 if n%2==0 else -1)*262)
            page.wait_for_timeout(15)
        page.wait_for_timeout(180)
        actual = page.evaluate('harbourQA.player.yaw')
        expected = start if n%2 else start+math.pi
        assert abs(math.remainder(actual-expected, math.tau)) < .25, (actual, expected)
    return read_profile(page, name)


def read_profile(page, name):
    frames = page.evaluate('harbourQA.scene.frameProfile()')
    ms = sorted(f['frameMs'] for f in frames)
    result = dict(site=name, frames=len(ms), fps=round(1000*len(ms)/sum(ms),1),
                  p95=ms[math.ceil(len(ms)*.95)-1], worst=max(ms),
                  over33=sum(t>33 for t in ms), cpuMs=round(sum(f['cpuMs'] for f in frames)/len(ms),1), calls=round(sum(f['calls'] for f in frames)/len(ms)),scale=frames[-1]['pixelRatio'],gpuMs=frames[-1].get('gpuMs'))
    print(result, flush=True)
    return result


with sync_playwright() as pw:
    browser = pw.chromium.launch(channel='chrome', headless=os.environ.get('HARBOUR_HEADED')!='1', args=['--enable-webgl','--ignore-gpu-blocklist'])
    page = browser.new_page(viewport=dict(width=1280,height=720), device_scale_factor=1)
    page.add_init_script("localStorage.setItem('altstadt.graphics.v3','performance')")
    page.route(re.compile(r'/client/App\.tsx(\?|$)'), observe)
    page.goto(BASE,wait_until='domcontentloaded')
    button = lambda name: page.get_by_role('button',name=name,exact=True)
    button('Verstanden · zur App').click()
    page.get_by_label('Benutzername',exact=True).fill('RoadQA'+str(int(time.time()))[-8:])
    page.get_by_label('Passwort',exact=True).fill('Local-Road-QA-4821')
    button('Profil anlegen & zur Lobby').click()
    button('Island').click()
    page.get_by_role('button',name='Einzelspieler & Koop').click()
    page.get_by_label('Variante').select_option('battle')
    enemies = int(os.environ.get('HARBOUR_ENEMIES', '0'))
    if enemies:
        page.get_by_label('Gefecht',exact=True).select_option('alone')
        page.get_by_label('Gegner',exact=True).select_option(str(enemies))
    else:
        page.get_by_label('Gefecht',exact=True).select_option('team')
    page.get_by_label('Schwierigkeit').select_option('easy')
    button('Charakter wählen & starten').click()
    button('Weiter zur Waffenauswahl').click()
    start = page.locator('.loadout-start')
    for _ in range(5):
        if start.is_enabled():
            break
        page.locator('.weapon-catalog button[aria-pressed=false]:enabled').first.click()
    start.click()
    page.wait_for_function("window.harbourQA?.state.phase==='playing' && harbourQA.scene?.worldPrepared",timeout=150000)
    page.evaluate('harbourQA.scene.worldPrepared')
    print(page.evaluate("()=>{const gl=document.querySelector('canvas').getContext('webgl2');return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)}"),flush=True)
    bots = page.evaluate("harbourQA.state.players.filter(p=>p.kind==='bot').length")
    assert bots == (enemies or 7), bots
    page.locator('canvas').last.click(force=True)
    page.wait_for_timeout(300)
    print('Island battle started with',bots,'bots',flush=True)
    def approach():
        for attempt in range(4):
            try:
                for x,z in [(-65,-26),(45,-26),(51,-23)]:
                    walk(page,x,z)
                return
            except AssertionError:
                if attempt==3 or page.evaluate('harbourQA.player.hp>0'):
                    raise
                page.wait_for_function('harbourQA.player.hp>0',timeout=20000)
                page.locator('.city-canvas').click(force=True)
    approach()
    results = []
    for name,x,inside,door in [('Harbour Supply',51,-9,-18),('Diner',63,-36,-28),('Coast Records',75,-9,-18)]:
        for attempt in range(3):
            try:
                walk(page,x,-23)
                page.evaluate('harbourQA.scene.profileFrames(3000)')
                walk(page,x,door)
                walk(page,x,inside)
                entry=read_profile(page,name+' entrance')
                print('Entered',name,flush=True)
                result=measure(page,name)
                page.evaluate('harbourQA.scene.profileFrames(3000)')
                walk(page,x,door)
                walk(page,x,-23)
                results.append(dict(entry=entry,turn=result,exit=read_profile(page,name+' exit')))
                break
            except AssertionError:
                if attempt==2 or page.evaluate('harbourQA.player.hp>0'):
                    raise
                page.wait_for_function('harbourQA.player.hp>0',timeout=20000)
                page.locator('.city-canvas').click(force=True)
                approach()
        print('Exited',name,flush=True)
    (OUT/f'report-{bots}-bots.json').write_text(json.dumps(dict(bots=bots,results=results),indent=2))
    browser.close()
