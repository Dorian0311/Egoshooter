"""Render cached kill portraits from actual game heads; requires local Vite and Playwright."""
import pathlib,json,base64,hashlib,subprocess
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1];target=root/'public/shooter/characters/portraits';target.mkdir(parents=True,exist_ok=True)
errors=[];entries=[]
# Snapshot the export code so concurrent development cannot hot-reload the batch.
subprocess.run(['node','--input-type=module','-e',"import {build} from 'esbuild'; await build({entryPoints:['tests/face-review.ts'],outfile:'artifacts/face-export-stable.js',bundle:true,format:'esm',target:'es2022'});"],cwd=root,check=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':192,'height':192});page.on('pageerror',lambda error:errors.append(str(error)));page.goto('http://127.0.0.1:5173/tests/face-review.html?stable',wait_until='networkidle');page.wait_for_function('window.faceExport!==undefined')
 for id in page.evaluate('faceExport.ids'):
  image=page.evaluate('(id)=>faceExport.render(id)',id);raw=base64.b64decode(image.split(',',1)[1]);file=target/(id+'-face.webp');file.write_bytes(raw)
  source=root/('public/shooter/characters/bonus/'+id+'.glb')
  if not source.exists():source=root/'public/shooter/characters/humanoid.json'
  entries.append({'id':id,'file':file.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'model':source.relative_to(root).as_posix(),'modelSha256':hashlib.sha256(source.read_bytes()).hexdigest()})
 browser.close()
manifest={'purpose':'Static kill-confirmation portraits, rendered from the original game head geometry and textures. No runtime portrait WebGL context or AI-generated substitute face.','generator':'scripts/render-character-faces.py and tests/face-review.ts','size':[192,192],'sourceRights':'Derived images retain the source model rights. Base humanoid/source-specific credits are documented in the character directories; no new license or redistribution permission is asserted for user-provided bonus characters.','renderInputs':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['tests/face-review.ts','client/humanoid.ts','client/bonusCharacters.ts','client/anatomy.ts','shared/uniforms.ts']},'entries':entries,'errors':errors}
(target/'PROVENANCE.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');print(json.dumps({'faces':len(entries),'totalBytes':sum(e['bytes'] for e in entries),'errors':errors}))
if errors:raise SystemExit(1)
