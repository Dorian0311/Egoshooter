"""Bake textile detail on the game's MakeHuman UVs. Requires NumPy and Pillow."""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / 'public/shooter/characters'
SIZE = 1536
model = json.loads((ROOT / 'humanoid.json').read_text())
positions = np.asarray(model['positions']).reshape(-1, 3)
uv = np.asarray(model['uv']).reshape(-1, 2)
uv[:, 1] = 1 - uv[:, 1]
uv *= SIZE - 1
categories = np.asarray(model['categories'])
cloth = np.full((SIZE, SIZE), np.nan, dtype=np.float32)
combat = cloth.copy()


def seam(distance, width):
    return np.exp(-np.square(distance / width))


def dye(x, y, z):
    """Garment panels, creases and topstitching follow the body through the rig."""
    a = np.abs(x)
    legs = y < .94
    sleeve = (a > .18) & (y > 1.02)
    knee = seam(y - .49, .095)
    elbow = seam(a - .37, .075) * sleeve
    ankle = seam(y - .26, .055)
    waist = seam(y - .96, .10)
    phase = y * 123 + z * 20 + np.sin(x * 21) * 1.6
    folds = np.sin(phase) + .44 * np.sin(phase * 1.57 + .8)
    tone = 223 - 12 * legs + folds * (12*knee + 10*elbow + 8*ankle + 4*waist)
    # Reinforced knee panels, button placket and twin-needle field-jacket hem.
    knee_patch = legs & (z < -.035) & (np.abs(y-.51)+.30*np.abs(a-.13) < .09)
    tone -= 15*knee_patch + 17*seam(y-.927, .005) + 9*seam(y-.94, .003)
    tone -= 22*seam(a-.014, .005)*(~legs)*(z<-.065)
    tone -= 8*seam(z+.002, .005)*legs
    weave = 2*np.sin(y*1000)+2*np.cos((x+z)*1200)
    base = tone + weave
    # Broad shapes remain readable at distance. Fine breaks disappear in the mipmaps.
    field = (np.sin(x*53 + y*16 + 1.4*np.sin(z*44-y*23))
             + .74*np.cos(z*64-y*32+np.sin(x*73))
             + .52*np.sin(y*81+x*43+z*35))
    camouflage = np.select([field<-.95, field<-.16, field<.75], [-44, -17, 7], default=18)
    return base, base+camouflage


for ids in np.asarray(model['indices']).reshape(-1, 3):
    if (categories[ids] == 1).sum() >= 2 or (categories[ids] == 2).sum() >= 2:
        continue
    a, b, c = uv[ids]
    dx1, dy1 = b-a
    dx2, dy2 = c-a
    determinant = dx1*dy2 - dx2*dy1
    if abs(determinant) < 1e-7:
        continue
    lo = np.floor(uv[ids].min(axis=0)).astype(int)
    hi = np.ceil(uv[ids].max(axis=0)).astype(int)
    yy, xx = np.mgrid[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
    u = ((xx-a[0])*dy2 - (yy-a[1])*dx2)/determinant
    v = (dx1*(yy-a[1]) - dy1*(xx-a[0]))/determinant
    valid = (u >= 0) & (v >= 0) & (u+v <= 1)
    if not valid.any():
        continue
    points = positions[ids[0]] + (positions[ids[1]]-positions[ids[0]])*u[valid,None] + (positions[ids[2]]-positions[ids[0]])*v[valid,None]
    values = dye(*points.T)
    for dst, result in zip([cloth, combat], values):
        dst[yy[valid],xx[valid]] = result

for name, data in [('field-cloth', cloth), ('island-cloth', combat)]:
    valid = np.isfinite(data)
    image = Image.fromarray(np.nan_to_num(data).clip(0,255).astype('uint8'))
    # Extend chart borders for mip sampling and fill unused islands with neutral cloth.
    border = image.filter(ImageFilter.MaxFilter(9))
    image = np.asarray(image)
    pixels = np.where(valid,image,np.where(np.asarray(border)>0,np.asarray(border),214)).astype('uint8')
    Image.fromarray(pixels).save(ROOT/(name+'.webp'), quality=86, method=6)
