"""Cut the back cover and spine out of a print-ready wrap cover.

    python scripts/cut-cover.py COVER.pdf INTERIOR.pdf OUTDIR

COVER.pdf is the one-page wrap (back, spine, front) with 0.125 in bleed all round, as
Lulu wants it. INTERIOR.pdf gives the trim width, so the spine is whatever is left:

    wrap width = bleed + back + spine + front + bleed

Writes OUTDIR/back-cover.jpg and OUTDIR/spine.jpg (200 dpi, bleed cut off) and prints
one line of JSON with the sizes in inches. Exit 2 means the cover does not fit the
interior (wrong height, or a spine outside 0.05-3 in): the editor's file is wrong.
Exit 1 is anything else. Used by scripts/sync-freely-given.js; needs PyMuPDF.
"""
import json
import os
import sys

import fitz  # PyMuPDF

BLEED = 0.125  # inches
DPI = 200


def fail(code, message):
    print(message, file=sys.stderr)
    sys.exit(code)


def main(cover_path, interior_path, out_dir):
    cover = fitz.open(cover_path)
    if len(cover) != 1:
        fail(2, f"the cover PDF has {len(cover)} pages; a wrap cover is one page")
    page = cover[0]
    wrap_w, wrap_h = page.rect.width / 72, page.rect.height / 72

    interior = fitz.open(interior_path)[0]
    trim_w, trim_h = interior.rect.width / 72, interior.rect.height / 72

    if abs(wrap_h - (trim_h + 2 * BLEED)) > 0.02:
        fail(2, f"cover is {wrap_h:.3f} in tall but the interior ({trim_h:.3f} in) plus 0.125 in bleed "
                f"top and bottom is {trim_h + 2 * BLEED:.3f} in")
    spine_w = wrap_w - 2 * BLEED - 2 * trim_w
    if not 0.05 <= spine_w <= 3:
        fail(2, f"cover is {wrap_w:.3f} in wide, which leaves a spine of {spine_w:.3f} in for an interior "
                f"{trim_w:.3f} in wide plus 0.125 in bleed each side")

    z = DPI / 72
    pt = lambda inches: inches * 72
    back = fitz.Rect(pt(BLEED), pt(BLEED), pt(BLEED + trim_w), pt(BLEED + trim_h))
    spine = fitz.Rect(pt(BLEED + trim_w), pt(BLEED), pt(BLEED + trim_w + spine_w), pt(BLEED + trim_h))
    os.makedirs(out_dir, exist_ok=True)
    for name, rect in (("back-cover.jpg", back), ("spine.jpg", spine)):
        pix = page.get_pixmap(matrix=fitz.Matrix(z, z), clip=rect, alpha=False)
        pix.save(os.path.join(out_dir, name), jpg_quality=88)
    print(json.dumps({"trim_w": round(trim_w, 3), "trim_h": round(trim_h, 3), "spine_w": round(spine_w, 3)}))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        fail(1, __doc__)
    try:
        main(*sys.argv[1:])
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        fail(1, f"{type(e).__name__}: {e}")
