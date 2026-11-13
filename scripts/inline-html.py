"""Make a built HTML book self-contained for Read Online.

    python scripts/inline-html.py IN.html OUT.html

The book builds (Psalm119Devotional's tools/build.mjs and the like) write book.html next to
a fonts/ folder and image files. The site serves one HTML file per book, so every relative
url(...) in CSS and every relative src="..." is replaced with a data: URI read from beside
IN.html. Absolute links (http:, https:, #, mailto:, data:) are left alone. Exits 1 if a
referenced file is missing, so a broken page is never written.
"""
import base64
import mimetypes
import os
import re
import sys

TYPES = {".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf",
         ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".gif": "image/gif", ".webp": "image/webp"}
SKIP = re.compile(r"^(?:[a-z]+:|#|//)", re.I)


def main(src, dst):
    base = os.path.dirname(os.path.abspath(src))
    html = open(src, encoding="utf-8").read()
    missing, count = [], 0

    def data_uri(ref):
        nonlocal count
        path = os.path.join(base, ref.split("?")[0].split("#")[0])
        if not os.path.isfile(path):
            missing.append(ref)
            return None
        ext = os.path.splitext(path)[1].lower()
        mime = TYPES.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"
        count += 1
        return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode("ascii")

    def css_url(m):
        ref = m.group(2)
        if SKIP.match(ref):
            return m.group(0)
        uri = data_uri(ref)
        return f"url({uri})" if uri else m.group(0)

    def src_attr(m):
        ref = m.group(2)
        if SKIP.match(ref):
            return m.group(0)
        uri = data_uri(ref)
        return f'{m.group(1)}"{uri}"' if uri else m.group(0)

    html = re.sub(r"url\((['\"]?)([^)'\"]+)\1\)", css_url, html)
    html = re.sub(r'(\bsrc=)"([^"]+)"', src_attr, html)
    if missing:
        print("missing files next to " + src + ": " + ", ".join(sorted(set(missing))), file=sys.stderr)
        sys.exit(1)
    open(dst, "w", encoding="utf-8", newline="\n").write(html)
    print(f"{dst}: {count} files inlined, {os.path.getsize(dst):,} bytes")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
