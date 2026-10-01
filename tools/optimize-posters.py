"""Encode the actual studio PNGs with lossless alpha (Pillow optional asset-tool dependency)."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
for pose in ('hero', 'side', 'threequarter', 'macro'):
    source = root / 'docs' / 'refinement' / 'render-source' / f'{pose}.png'
    destination = root / 'public' / 'renders' / f'{pose}.webp'
    with Image.open(source) as image:
        image.save(destination, 'WEBP', quality=94, method=6, exact=True)
    print(f'{pose}: {destination.stat().st_size} bytes')
