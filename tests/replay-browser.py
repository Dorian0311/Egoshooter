import pathlib,json,base64
from playwright.sync_api import sync_playwright
output=pathlib.Path('artifacts/operations-20261116');output.mkdir(parents=True,exist_ok=True)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':960,'height':640},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173/tests/replay-review.html',wait_until='networkidle')
 page.wait_for_timeout(5000)
 with page.expect_download(timeout=60000) as capture:page.get_by_role('button',name='720p-WebM speichern').click()
 capture.value.save_as(str(output/'highlight.webm'))
 raw=(output/'highlight.webm').read_bytes();assert len(raw)>1000,{'bytes':len(raw),'status':page.get_by_role('status').inner_text(),'errors':errors}
 metadata=page.evaluate("""async encoded=>{const raw=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([raw],{type:'video/webm'})),video=document.createElement('video');video.muted=true;video.src=url;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Metadata timeout')),10000);video.onloadedmetadata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>reject(Error('Recorded video invalid'));video.load();});const data={width:video.videoWidth,height:video.videoHeight,duration:String(video.duration)};URL.revokeObjectURL(url);return data;}""",base64.b64encode(raw).decode())
 assert metadata['width']==1280 and metadata['height']==720,metadata
 report={'export':metadata,'bytes':len(raw),'errors':errors};(output/'replay-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
 browser.close()
 if errors:raise SystemExit(1)
