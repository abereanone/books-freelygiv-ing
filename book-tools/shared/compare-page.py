"""Every change from the source text to the edition, on one page: the edition's words, with each
place it differs from the source marked (source struck through, edition underlined; hover a change
for both). One self-contained HTML file, to read before a book goes to Michael and for anyone who
wants to see what the edition changed.

The idea is Courtney Hicks's comparison page (colophon tei_review.py, adopted 2026-11-27); this
version compares two plain texts word by word instead of reading a TEI file.

Usage, from the book's folder:
  python -I C:/code/books-freelygiv-ing/book-tools/shared/compare-page.py SOURCE EDITION... -o dist/compare.html --title T
  scanned-book:  source/raw.md text/*.md
SOURCE is the text as scanned or keyed (OCR output); EDITION one or more Markdown files in order.
"""
import argparse, difflib, glob, html, re, sys

def clean(t):
    t = re.sub(r"<!--.*?-->", " ", t, flags=re.S)
    t = re.sub(r"(?m)^\[\^[^\]]+\]:.*(?:\n(?:    |\t).*)*", " ", t)   # footnote texts: notes, not the text
    t = re.sub(r"(?ms)^---\n.*?\n---\s*$", " ", t)     # front matter (title: ...)
    t = re.sub(r"(?m)^\s{0,3}#+\s*", "", t)            # heading marks
    t = re.sub(r"(?m)^\s{0,3}>\s?", "", t)             # blockquote marks
    t = re.sub(r"[*_]+", "", t)                         # emphasis marks
    t = re.sub(r"\[\^[^\]]+\]:?", " ", t)               # footnote calls and labels
    t = re.sub(r"<[^>]+>", " ", t)                      # inline HTML
    return t

def paras(t):
    """[[word, ...], ...]: paragraphs of words, punctuation kept on its word."""
    return [p.split() for p in re.split(r"\n\s*\n", clean(t)) if p.split()]

def main():
    a = argparse.ArgumentParser()
    a.add_argument("source"); a.add_argument("edition", nargs="+")
    a.add_argument("-o", "--out", required=True); a.add_argument("--title", default="Changes")
    o = a.parse_args()
    src = open(o.source, encoding="utf-8").read()
    files = [f for pat in o.edition for f in sorted(glob.glob(pat))]
    ed = "\n\n".join(open(f, encoding="utf-8").read() for f in files)
    sp, ep = paras(src), paras(ed)
    # words in one stream, paragraph ends as tokens, so a change can cross a paragraph break
    S = [w for p in sp for w in p + ["\u00b6"]]
    E = [w for p in ep for w in p + ["\u00b6"]]
    sm = difflib.SequenceMatcher(None, S, E, autojunk=False)
    out, counts = ["<p>"], {"changed": 0, "added": 0, "removed": 0}
    def words(ws):
        return " ".join(html.escape(w) for w in ws if w != "\u00b6")
    def emit_edition(ws):
        for w in ws:
            out.append("</p>\n<p>" if w == "\u00b6" else html.escape(w) + " ")
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            emit_edition(E[j1:j2]); continue
        old, new = words(S[i1:i2]), words(E[j1:j2])
        kind = "changed" if old and new else ("added" if new else "removed")
        if not old and not new:
            emit_edition(E[j1:j2]); continue            # only a paragraph break moved
        counts[kind] += 1
        tip = html.escape(f"source: {old or '(nothing)'}  \u2192  edition: {new or '(nothing)'}", quote=True)
        out.append(f'<span class="c {kind}" title="{tip}">')
        if old: out.append(f"<del>{old}</del> ")
        if new: out.append(f"<ins>{new}</ins> ")
        out.append("</span>")
        if "\u00b6" in E[j1:j2]: out.append("</p>\n<p>")
    out.append("</p>")
    body = "".join(out).replace("<p></p>", "")
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(o.title)}: changes</title>
<style>
:root {{ --bg:#fbf8f2; --fg:#2b2620; --del:#a3352b; --ins:#21613a; --mark:#f3e7c9; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#1d1b18; --fg:#e8e2d6; --del:#e58c80; --ins:#8fd3a5; --mark:#3a3324; }} }}
body {{ background:var(--bg); color:var(--fg); font:17px/1.6 Georgia, serif; max-width:40em; margin:0 auto; padding:16px; }}
header {{ position:sticky; top:0; background:var(--bg); padding:8px 0; border-bottom:1px solid #8884; }}
h1 {{ font-size:1.2em; margin:0 0 6px; }}
button {{ font:inherit; font-size:14px; margin-right:6px; }}
.c {{ background:var(--mark); border-radius:3px; }}
del {{ color:var(--del); }} ins {{ color:var(--ins); text-decoration:underline; }}
body.edition del {{ display:none; }} body.edition ins {{ color:inherit; text-decoration:none; }} body.edition .c {{ background:none; }}
body.source ins {{ display:none; }} body.source del {{ color:inherit; text-decoration:none; }} body.source .c {{ background:none; }}
</style></head>
<body><header><h1>{html.escape(o.title)}</h1>
<button onclick="document.body.className=''">Changes</button><button onclick="document.body.className='edition'">Edition</button><button onclick="document.body.className='source'">Source</button>
<small>{counts['changed']} changed, {counts['added']} added, {counts['removed']} removed</small></header>
{body}
</body></html>
"""
    open(o.out, "w", encoding="utf-8", newline="\n").write(page)
    print(f"{o.out}: {counts['changed']} changed, {counts['added']} added, {counts['removed']} removed ({len(files)} edition files)")

if __name__ == "__main__":
    main()
