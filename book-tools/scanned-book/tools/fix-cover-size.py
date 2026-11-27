"""Chrome rounds the cover PDF's page size to whole pixels; set the exact Lulu size.
Usage: python -I tools/fix-cover-size.py cover/cover-lulu.pdf <pages>"""
import sys, site
sys.path.append(site.getusersitepackages())
import pypdf
path, pages = sys.argv[1], int(sys.argv[2])
tw, th = (float(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '6x9').split('x'))
w = (2 * tw + pages / 444 + 0.06 + 0.25) * 72
h = (th + 0.25) * 72
r = pypdf.PdfReader(path); wr = pypdf.PdfWriter()
for p in r.pages:
    p.mediabox.lower_left = (0, 0); p.mediabox.upper_right = (w, h)
    p.cropbox.lower_left = (0, 0); p.cropbox.upper_right = (w, h)
    wr.add_page(p)
wr.write(path)
print(f'{path}: {w/72:.3f} x {h/72:.3f} in')
