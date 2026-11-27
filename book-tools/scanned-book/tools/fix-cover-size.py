"""Chrome rounds the cover PDF's page size to whole pixels; set the exact Lulu size.
Usage: python -I tools/fix-cover-size.py cover/cover-lulu.pdf [pages] [trim]
Without pages, the count of the interior built last (dist/print-facts.json, from tools/build.mjs --pdf)."""
import sys, site
sys.path.append(site.getusersitepackages())
import pypdf
import json, os
path = sys.argv[1]
facts = json.load(open('dist/print-facts.json', encoding='utf-8')) if os.path.exists('dist/print-facts.json') else None
if len(sys.argv) > 2:
    pages = int(sys.argv[2])
elif facts:
    pages = facts['pdfs'][facts['latest']]['pages']
else:
    sys.exit('No page count: pass it, or build the interior first (node tools/build.mjs --pdf)')
trim = sys.argv[3] if len(sys.argv) > 3 else (facts['pdfs'][facts['latest']]['trim'] if facts and len(sys.argv) == 2 else '6x9')
tw, th = (float(x) for x in trim.split('x'))
w = (2 * tw + pages / 444 + 0.06 + 0.25) * 72
h = (th + 0.25) * 72
r = pypdf.PdfReader(path); wr = pypdf.PdfWriter()
for p in r.pages:
    p.mediabox.lower_left = (0, 0); p.mediabox.upper_right = (w, h)
    p.cropbox.lower_left = (0, 0); p.cropbox.upper_right = (w, h)
    wr.add_page(p)
wr.write(path)
print(f'{path}: {w/72:.3f} x {h/72:.3f} in')
