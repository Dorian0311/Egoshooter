"""Record real canvas motion, with existing in-game model quality (silent WebM)."""
from pathlib import Path
import base64,json
from playwright.sync_api import sync_playwright
out=Path('artifacts/remains-client');out.mkdir(parents=True,exist_ok=True)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1280,'height':720});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/tests/remains-review.html',wait_until='networkidle');page.wait_for_function('remainsReview.ready()',timeout=60000)
 id=page.evaluate("remainsReview.spawnPart('armL')");page.wait_for_function('(id)=>remainsReview.partReady(id)',arg=id,timeout=30000)
 page.evaluate('remainsReview.look(-.12)')
 page.evaluate('''()=>{const stream=document.querySelector('canvas').captureStream(30),mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';window.captureChunks=[];window.captureRecorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:3000000});captureRecorder.ondataavailable=e=>{if(e.data.size)captureChunks.push(e.data)};captureRecorder.start(100);}''')
 page.wait_for_timeout(700);assert page.evaluate('(id)=>remainsReview.act(`part:pickup:${id}`)',id);page.wait_for_timeout(1000);page.screenshot(path=str(out/'video-1-pickup.png'),timeout=60000)
 page.evaluate('remainsReview.swing()');page.wait_for_timeout(350);page.screenshot(path=str(out/'video-2-swing.png'),timeout=60000);page.wait_for_timeout(700)
 assert page.evaluate("remainsReview.act('throw')");page.evaluate('(id)=>remainsReview.followPart(id)',id);page.wait_for_timeout(350);page.screenshot(path=str(out/'video-3-throw.png'),timeout=60000);page.wait_for_timeout(3500)
 data=page.evaluate('''()=>new Promise(resolve=>{captureRecorder.onstop=()=>{const blob=new Blob(captureChunks,{type:'video/webm'}),reader=new FileReader();reader.onloadend=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);captureRecorder.stream.getTracks().forEach(t=>t.stop());};captureRecorder.stop();})''')
 output=out/'original-model-pickup-swing-throw.webm';output.write_bytes(base64.b64decode(data));browser.close();print(json.dumps({'path':str(output),'bytes':output.stat().st_size,'errors':errors}))
 if errors:raise SystemExit(1)
