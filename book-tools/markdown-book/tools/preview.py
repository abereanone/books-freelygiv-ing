# Render chosen PDF pages to a contact sheet: python tools/preview.py 1,2,3,... out.png
import sys, os, fitz
from PIL import Image
doc = fitz.open(os.environ.get('PDF', 'dist/Meditations-on-Psalm-119.pdf'))  # PDF=dist/other.pdf for another edition
pages = [int(p) for p in sys.argv[1].split(',')]
ims = []
for p in pages:
    pix = doc[p - 1].get_pixmap(dpi=int(sys.argv[3]) if len(sys.argv) > 3 else 80)
    ims.append(Image.frombytes('RGB', (pix.width, pix.height), pix.samples))
w, h = ims[0].size
cols = min(4, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 10), rows * (h + 10)), 'gray')
for i, im in enumerate(ims):
    sheet.paste(im, ((i % cols) * (w + 10), (i // cols) * (h + 10)))
sheet.save(sys.argv[2])
print(len(doc), 'pages')
