"""Generate smaller runtime copies; keep original art and attribution untouched.

Run with Python + Pillow when the source materials or lobby art change.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
materials = root / "public/shooter/materials"
sources = sorted(materials.glob("*/*.jpg"))
original_bytes = runtime_bytes = 0
for source in sources:
    destination = materials / "runtime-v1" / source.parent.name / source.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        image.save(destination, quality=90 if source.stem == "normal" else 85,
                   subsampling=0 if source.stem == "normal" else 2, optimize=True)
    original_bytes += source.stat().st_size
    runtime_bytes += destination.stat().st_size

source = root / "public/shooter/lobby/encampment-v1.png"
destination = source.with_suffix(".webp")
with Image.open(source) as image:
    image.convert("RGB").save(destination, "WEBP", quality=82, method=6)
print(f"Materials: {len(sources)} images, {original_bytes / 1048576:.1f} -> {runtime_bytes / 1048576:.1f} MiB")
print(f"Lobby background: {source.stat().st_size / 1024:.0f} -> {destination.stat().st_size / 1024:.0f} KiB")
