"""Build the UV maps for the close glove-free grip and the field jacket cuff."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / 'public/shooter'
OUT = ROOT/'materials'/'viewmodel'
OUT.mkdir(parents=True,exist_ok=True)
N = 512
rng = np.random.default_rng(1945)
v,u = np.mgrid[0:N,0:N]/(N-1)


def noise(size):
    grid=(rng.random((size,size))*255).astype('uint8')
    return np.asarray(Image.fromarray(grid).resize((N,N),Image.Resampling.BICUBIC)).astype(float)/255-.5


def ridge(distance,width):
    return np.exp(-np.square(distance/width))


def save(name, rgb):
    Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(OUT/(name+'.webp'),quality=89,method=6)


def finish_map(name,rgb,polish):
    # Alpha is packed roughness reduction for opaque surfaces. Moderate precision
    # keeps the gradients smooth while the existing normal map resolves the fibres.
    alpha=np.rint(np.clip(1-polish,0,1)*127)*2+1
    save(name,np.dstack((rgb,alpha)))


def normal(name,height,strength):
    dy,dx=np.gradient(height)
    direction=np.stack((-dx*strength,dy*strength,np.ones_like(height)),axis=-1)
    direction/=np.linalg.norm(direction,axis=-1,keepdims=True)
    save(name,(direction+1)*127.5)


# Low-frequency complexion from the CC0 MakeHuman skin already used by the actors.
source=Image.open(ROOT/'characters'/'skin.png').convert('RGB')
patch=source.crop((228,252,292,316)).resize((N,N),Image.Resampling.BICUBIC)
patch=np.asarray(patch.filter(ImageFilter.GaussianBlur(2)),dtype=float)
patch-=patch.mean(axis=(0,1))
x=u*.20-.10
y=(1-v)*.26-.09
knuckles=np.zeros_like(x);creases=np.zeros_like(x)
for cx,cy in [( .0245,.093),(.0045,.097),(-.0145,.093),(-.0315,.083)]:
    dx=x-cx;dy=y-cy
    knuckles+=np.exp(-np.square(dx/.010)-np.square(dy/.014))
    for distance in [-.004,0,.0033]:
        bend=dy-distance-12*dx*dx-.0007*np.sin(dx*460+cy*70)
        creases+=ridge(bend,.0005)*np.exp(-np.power(dx/.007,4))
for height in [-.004,-.0008,.003]:
    creases+=.46*ridge(y-height-.001*np.sin(x*119)-.10*x,.00055)*np.exp(-(x/.031)**4)
vein=np.zeros_like(x)
for cx,cy,length,slope in [(-.013,.043,.032,-.12),(.009,.049,.030,.23),(.003,.016,.017,-.42)]:
    vein+=ridge(x-cx-slope*(y-cy)-.0018*np.sin((y-cy)*169),.0014)*np.exp(-((y-cy)/length)**4)
pores=np.maximum(0,noise(211)-.13)
mottle=noise(22)*5+noise(66)*2
skin=(np.array([185,140,114])+patch*.85+mottle[:,:,None]+knuckles[:,:,None]*[9,-6,-7]
      -creases[:,:,None]*[23,26,23]-vein[:,:,None]*[8,4,2]-pores[:,:,None]*[15,12,10])
# Gentle, broad highlights across the fingers and back of the hand. Folds and
# fine folds interrupt that highlight; skin keeps its colour in diffuse light.
contact=ridge(x+.022,.050)*ridge(y-.052,.048)
skin_polish=np.clip(.055+.11*contact+.095*knuckles-.058*creases,0,.25)
finish_map('hand-skin',skin,skin_polish)
normal('hand-skin-normal',knuckles*1.8-creases*.72+vein*.23-pores*.43,1.05)

# Cylinder UVs unwrap from shoulder at v=0 to wrist at v=1. Cuff seam
# placement corresponds to the raised geometry at 2.5 and 14.5 percent.
warp=np.sin(2*np.pi*(u*158+v*1.2))
weft=np.cos(2*np.pi*v*206)
twill=np.sin(2*np.pi*(u*75-v*103))
cuff=v<.144
panel=ridge(u-.30,.014)+ridge(u-.76,.014)
tone=218 + warp*1.8+weft*1.6+twill*2.3+noise(54)*5
tone-=cuff*13+panel*19
relief=warp*.12+weft*.10+twill*.1
for lane in [.026,.134,.148]:
    phase=(np.cos(2*np.pi*(u*79+.17))+.2).clip(0,1)
    seam=ridge(v-lane,.0038)
    tone-=seam*28; tone+=seam*phase*48
    relief+=seam*(phase*.85-.22)
for lane in [.287,.305,.750,.765]:
    phase=(np.cos(2*np.pi*v*119)+.15).clip(0,1)
    seam=ridge(u-lane,.003)
    tone-=seam*17;tone+=seam*phase*35
    relief+=seam*(phase*.70-.18)
# Worn cuff edges and raised stitching catch narrow highlights. Recessed
# panels stay matte and the broader worn band survives mip filtering.
edge=ridge(v-.024,.015)+.62*ridge(v-.14,.012)
cloth_polish=np.clip(.024+.075*cuff+.10*edge+.05*panel+.022*twill,0,.22)
finish_map('jacket-twill',np.repeat(tone[:,:,None],3,axis=2),cloth_polish)
normal('jacket-twill-normal',relief,1.15)
