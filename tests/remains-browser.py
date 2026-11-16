"""Actual WebGL checks for persistent corpse, every throwable part, harvest and medical carry."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
out=Path('artifacts/remains-client');out.mkdir(parents=True,exist_ok=True)
errors=[];checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1100,'height':800});page.on('pageerror',lambda error:errors.append(str(error)))
 def start():
  page.goto('http://127.0.0.1:5173/tests/remains-review.html',wait_until='networkidle');page.wait_for_function('window.remainsReview?.ready()',timeout=60000)
 start()
 for part in ['armL','armR','legL','legR','head']:
  id=page.evaluate('(part)=>remainsReview.spawnPart(part)',part);page.wait_for_function('(id)=>remainsReview.partReady(id)',arg=id,timeout=30000)
  assert page.evaluate('(id)=>remainsReview.act(`part:pickup:${id}`)',id);page.wait_for_timeout(200)
  assert page.evaluate('(id)=>remainsReview.state().players.find(p=>p.id==="helper").heldPart===id',id)
  page.screenshot(path=str(out/(part+'-held.png')),timeout=60000);page.evaluate('remainsReview.swing()');page.wait_for_timeout(250)
  assert page.evaluate("remainsReview.act('throw')");assert page.evaluate('(id)=>remainsReview.state().bodyParts.find(p=>p.id===id).state==="flying"',id);page.wait_for_timeout(500)
  checks.append(part+' original geometry picked up, swung and thrown')
 start();page.evaluate("remainsReview.advance(20000)");assert page.evaluate('remainsReview.state().corpses.length')==1
 assert page.evaluate('remainsReview.act(`corpse:carry:${remainsReview.corpseId}`)');page.evaluate('remainsReview.damageShield(40)');assert page.evaluate('remainsReview.state().players.find(p=>p.id==="helper").corpseShield')==110
 page.evaluate('remainsReview.thirdPerson(true)');page.wait_for_timeout(250);page.screenshot(path=str(out/'corpse-carry.png'),timeout=60000)
 tent=page.evaluate('remainsReview.atTent()');assert page.evaluate('(id)=>remainsReview.act(`tent:deposit:${id}`)',tent);page.wait_for_timeout(200);page.screenshot(path=str(out/'medical-tent.png'),timeout=60000);page.evaluate('remainsReview.advance(8100)');assert page.evaluate('remainsReview.state().players.find(p=>p.id==="patient").hp')==100;checks.append('Persistent corpse, damage-depleting shield and medical-tent revival')
 start();assert page.evaluate('remainsReview.act(`corpse:harvest:${remainsReview.corpseId}`)');page.wait_for_timeout(1100);page.screenshot(path=str(out/'harvest-reach.png'),timeout=60000);page.wait_for_timeout(900);page.screenshot(path=str(out/'harvest-pull.png'),timeout=60000);page.wait_for_function('!!remainsReview.state().players.find(p=>p.id==="helper").heldPart',timeout=10000)
 id=page.evaluate('remainsReview.state().players.find(p=>p.id==="helper").heldPart');page.wait_for_function('(id)=>remainsReview.partReady(id)',arg=id,timeout=30000);page.screenshot(path=str(out/'harvest-head-held.png'),timeout=60000);assert page.evaluate('remainsReview.state().corpses[0].lost&1');assert page.evaluate('(id)=>remainsReview.state().bodyParts.find(p=>p.id===id).uniform',id)=='kroenen';checks.append('Three-second reach/pull/twist/release harvest retains original Kroenen head')
 page.wait_for_timeout(700);page.evaluate('remainsReview.reviewHead(-.6)');page.wait_for_timeout(200);page.screenshot(path=str(out/'original-head-quarter.png'),timeout=60000)
 report={'passed':checks,'errors':errors,'final':page.evaluate('remainsReview.stats()')};(out/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report));browser.close()
 if errors:raise SystemExit(1)
