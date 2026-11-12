import urllib.request,hashlib,json
from pathlib import Path
sha='b87763c35dc9c0242d7eb4addb7d0f856b4f161357903a071bacd257fa0b5b90'
u='https://raw.githubusercontent.com/bultodepapas/OpenRCsimulator/0a274a2148bd180db4199de3572482761d3e8190/app/assets/scenery/population/textures/'+sha+'.png'
b=urllib.request.urlopen(u,timeout=30).read();assert hashlib.sha256(b).hexdigest()==sha
p=Path('public/shooter/characters/skin.png');p.write_bytes(b)
p.with_suffix('.source.json').write_text(json.dumps({'source':u,'sha256':sha,'license':'CC0-1.0','author':'MakeHuman system assets','asset':'middleage_lightskinned_male_diffuse','catalog':'https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html'},indent=2))
print('Verified skin texture:',len(b),'bytes')
