"""Decode actual recorded WebM in Chromium and inspect an evenly spaced contact sheet."""
from pathlib import Path
import base64,json
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
out=Path('artifacts/remains-client');samples=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1280,'height':720})
 page.goto('http://127.0.0.1:5173/tests/remains-review.html');page.wait_for_function('!!window.remainsReview');page.evaluate("dispatchEvent(new Event('pagehide'))");page.set_content('<video id="v" src="http://127.0.0.1:5173/artifacts/remains-client/original-model-pickup-swing-throw.webm" preload="auto" muted></video>')
 page.wait_for_function('document.querySelector("video").readyState>=2')
 page.evaluate('document.querySelector("video").currentTime=1000000');page.wait_for_function('!document.querySelector("video").seeking')
 duration=page.evaluate('document.querySelector("video").duration')
 for i in range(8):
  when=min(duration-.05,(i+.5)*duration/8)
  data=page.evaluate('''async time=>{const video=document.querySelector('video');await new Promise(resolve=>{video.onseeked=resolve;video.currentTime=time});const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').drawImage(video,0,0,640,360);return canvas.toDataURL('image/png').split(',')[1];}''',when)
  file=out/f'decoded-video-{i}.png';file.write_bytes(base64.b64decode(data));samples.append((file,when))
 browser.close()
sheet=Image.new('RGB',(1280,4*390),'#17231d');draw=ImageDraw.Draw(sheet)
for i,(file,when) in enumerate(samples):
 x=(i%2)*640;y=(i//2)*390;sheet.paste(Image.open(file),(x,y));draw.text((x+8,y+366),f'{when:.1f} s · original in-game model',fill='white')
sheet.save(out/'recorded-video-contact.png');print(json.dumps({'duration':duration,'frames':len(samples),'contact':str(out/'recorded-video-contact.png')}))
