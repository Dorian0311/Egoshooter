"""Fetch a small, documented selection of Kenney CC0 audio, without executing archive content."""
import urllib.request, urllib.parse, re, zipfile, io, json, pathlib, hashlib
root=pathlib.Path('public/shooter/audio');root.mkdir(parents=True,exist_ok=True)
manifest={};sources=[]
for pack in ['rpg-audio','impact-sounds']:
 page='https://kenney.nl/assets/'+pack
 html=urllib.request.urlopen(page,timeout=30).read().decode()
 links=re.findall(r'(?:href|data-url)=["\']([^"\']+\.zip(?:\?[^"\']*)?)["\']',html)
 if links:url=urllib.parse.urljoin(page,links[0])
 else:
  match=re.search(r"data-download-id=['\"]([^'\"]+)",html)
  if not match:raise RuntimeError('No archive link on '+page)
  request=urllib.request.Request('https://kenney.nl/download-link/'+match.group(1),headers={'Referer':page,'Accept':'application/json'})
  payload=json.load(urllib.request.urlopen(request,timeout=30))
  url=payload.get('url') or payload.get('downloadUrl') or payload.get('download')
  if not isinstance(url,str):raise RuntimeError('Unexpected download response keys: '+str(list(payload)))
 if urllib.parse.urlparse(url).hostname!='kenney.nl':raise RuntimeError('Unexpected download host '+str(urllib.parse.urlparse(url).hostname))
 data=urllib.request.urlopen(url,timeout=60).read();archive=zipfile.ZipFile(io.BytesIO(data))
 files=sorted(f for f in archive.namelist() if f.lower().endswith('.ogg'))
 for label,pattern in [('footstep','footstep')] if pack=='rpg-audio' else [('metal','metal'),('wood','wood'),('stone','stone'),('glass','glass')]:
  chosen=[f for f in files if pattern in pathlib.PurePosixPath(f).name.lower()][:4]
  if not chosen and label=='stone':chosen=[f for f in files if 'generic' in f.lower()][:4]
  manifest[label]=[]
  for f in chosen:
   name=pack+'-'+pathlib.PurePosixPath(f).name;raw=archive.read(f);(root/name).write_bytes(raw);manifest[label].append('/shooter/audio/'+name)
 sources.append({'pack':pack,'source':page,'archive':urllib.parse.urlunsplit((*urllib.parse.urlsplit(url)[:3],'','')),'sha256':hashlib.sha256(data).hexdigest(),'license':'CC0-1.0'})
(root/'manifest.json').write_text(json.dumps(manifest,indent=2));(root/'CREDITS.json').write_text(json.dumps(sources,indent=2))
print(json.dumps({k:len(v) for k,v in manifest.items()}))
