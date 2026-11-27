"""Square, circle-ready crop of author-gray.jpg for the back covers -> author-circle.jpg (copy it into a book's cover/assets/). Face centred, a little space above the hair, cut at the upper chest (Michael, 2026-11-14).
The photo has little background above the head, so the top is extended with the backdrop's own grey.

  python make-author-circle.py
"""
from pathlib import Path
import shutil
import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
SRC = HERE / 'author-gray.jpg'
CX, CY, R = 545, 262, 292          # circle in source pixels (photo is 1122 x 1402; hair top ~66, chin ~375)
OUT_PX = 700

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
pad = max(0, R - CY + 4)
if pad:  # extend the backdrop upward: repeat the top rows' grey, softened so no edge shows
    top = Image.fromarray(im[:12].mean(0, keepdims=True).repeat(pad, 0).clip(0, 255).astype(np.uint8))
    top = np.asarray(top.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
    im = np.concatenate([top, im], 0)
cy = CY + pad
crop = im[cy - R:cy + R, CX - R:CX + R]
out = Image.fromarray(crop.clip(0, 255).astype(np.uint8)).resize((OUT_PX, OUT_PX), Image.LANCZOS)
out.save(HERE / 'author-circle.jpg', quality=92, subsampling=0)
print(f'author-circle.jpg {OUT_PX}px (top extended {pad}px)')
