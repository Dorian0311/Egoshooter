"""Bake Island faces on the original CC0 MakeHuman atlas with Pillow and NumPy."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / 'public/shooter/characters'
source = Image.open(ROOT / 'skin.png').convert('RGB')
rgb = np.array(source, dtype=np.float32)
x, y = np.meshgrid(np.arange(source.width), np.arange(source.height))


def region(cx, cy, sx, sy):
    return np.exp(-0.5 * (((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))


def render(name, seed, skin_tint, beard):
    rng = np.random.default_rng(seed)
    # Low-frequency variation survives distance filtering, individual hairs fade with mipmaps.
    grain = rng.random(x.shape)
    flecks = np.array(Image.fromarray((grain * 255).astype('uint8'))
                      .filter(ImageFilter.GaussianBlur(0.55))) / 255
    luma = rgb @ [0.2126, 0.7152, 0.0722]
    low = np.array(Image.fromarray(luma.astype('uint8')).filter(ImageFilter.GaussianBlur(3)))
    surface = rgb * skin_tint
    face = region(885, 529, 91, 98)
    surface += ((luma - low) * face * 0.80)[..., None]
    chin = region(973, 529, 28, 55)
    cheeks = region(929, 462, 27, 28) + region(929, 596, 27, 28)
    moustache = region(918, 529, 5, 25)
    mouth = region(932, 529, 8, 23)
    whiskers = np.clip((chin + cheeks + moustache) * (1 - mouth), 0, 1)
    surface -= (whiskers * beard * (0.58 + np.maximum(flecks - 0.48, 0) * 3.2))[..., None] * [30, 27, 22]
    for eye_y in [491, 566]:
        brow = region(841, eye_y, 4, 14)
        surface -= (brow * (0.45 + flecks))[..., None] * [30, 28, 23]
        surface -= region(866, eye_y, 5, 14)[..., None] * [8, 10, 9]
    warm = region(894, 528, 9, 14) + region(887, 471, 18, 21) + region(887, 587, 18, 21)
    surface += warm[..., None] * [4, -3, -3]
    Image.fromarray(np.clip(surface, 0, 255).astype('uint8')).save(ROOT / f'{name}-skin.webp', quality=92, method=6)


render('task-olive', 8391, [0.91, 0.85, 0.79], 1.45)
render('task-sand', 2517, [0.99, 0.96, 0.94], 0.50)
