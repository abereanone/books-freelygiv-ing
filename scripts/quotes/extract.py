"""Pull plain text out of a book's Read Online HTML, for finding and checking quotes.

    python scripts/quotes/extract.py <book-slug> [<book-slug> ...]

Writes tmp/quotes/<slug>/:
  paragraphs.jsonl  one paragraph per line: {anchor, chapter, text, refs}
  sentences.tsv     candidate sentences (8-45 words) with anchor, chapter and the
                    Scripture references found in their paragraph, for picking quotes.

anchor  = id of the nearest heading/section above the paragraph, so the quote page can
          link straight to that spot in Read Online (/static/books/<slug>/<slug>.html#anchor).
chapter = text of the nearest heading above it.
"""
import html, json, re, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "data/src/books"

BIBLE = r"(?:Gen|Exod?|Lev|Num|Deut|Josh|Judg|Ruth|(?:1|2|I|II)\s?Sam|(?:1|2|I|II)\s?Kings?|(?:1|2|I|II)\s?Chron|Ezra|Neh|Esth|Job|Psa?l?m?s?|Prov|Eccl?e?s?|Song|Cant|Isa|Jer|Lam|Ezek?|Dan|Hos|Joel|Amos|Obad|Jonah|Mic|Nah|Hab|Zeph|Hag|Zech|Mal|Matt?h?|Mark|Luke|John|Acts|Rom|(?:1|2|I|II)\s?Cor|Gal|Eph|Phil|Col|(?:1|2|I|II)\s?Thess?|(?:1|2|I|II)\s?Tim|Titus|Philem|Heb|James|Jas|(?:1|2|I|II)\s?Pet|(?:1|2|3|I|II|III)\s?John|Jude|Rev)[a-z]*\.?"
REF = re.compile(rf"\b({BIBLE})\s+(\d+)\s*[:.]\s*(\d+(?:\s*[-–,]\s*\d+)*)")

SKIP_IDS = re.compile(r"^(fn|page-|toc|close-toc|ref)", re.I)
BLOCK = {"p", "li", "blockquote"}
HEAD = {"h1", "h2", "h3", "h4", "h5"}


class Walker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.anchor, self.chapter = "", ""
        self.paras = []
        self.buf, self.in_block, self.in_head, self.head_buf = None, 0, False, []
        self.skip_tag, self.skip = None, 0  # inside footnotes, nav, sup, script, table of contents

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls, id_ = a.get("class") or "", a.get("id") or ""
        if self.skip:
            if tag == self.skip_tag:
                self.skip += 1
            return
        if tag in ("script", "style", "nav", "sup") or "footnote" in cls or "toc" in cls.split("-")[0].split() or id_ in ("toc", "footnotes"):
            self.skip_tag, self.skip = tag, 1
            return
        if id_ and not SKIP_IDS.match(id_) and (tag in HEAD or tag in ("section", "div", "header", "article")):
            self.anchor = id_
        if tag in HEAD:
            self.in_head, self.head_buf = True, []
        elif tag == "p" and not self.in_head:
            self.buf = []

    def handle_endtag(self, tag):
        if self.skip:
            if tag == self.skip_tag:
                self.skip -= 1
            return
        if tag in HEAD and self.in_head:
            t = clean("".join(self.head_buf))
            if t and t.lower() != "contents":
                self.chapter = t
            self.in_head = False
        elif tag == "p" and self.buf is not None:
            t = clean("".join(self.buf))
            if t:
                self.paras.append({"anchor": self.anchor, "chapter": self.chapter, "text": t,
                                   "refs": [m.group(0) for m in REF.finditer(t)]})
            self.buf = None

    def handle_data(self, data):
        if self.skip:
            return
        if self.in_head:
            self.head_buf.append(data)
        elif self.buf is not None:
            self.buf.append(data)


def clean(s):
    s = html.unescape(s).replace(" ", " ").replace("×", "")
    return re.sub(r"\s+", " ", s).strip()


START_BAD = re.compile(r"^(this|these|those|it|they|them|thus|such|and|but|so|for|or|nor|yet|which|that|he|she|his|here|there|now|then|again|also|lastly|first|secondly|thirdly|fourthly|fifthly|(\(?\d+|[ivx]+)[.)])\b", re.I)


def sentences(text):
    parts = re.split(r"(?<=[.!?’”])\s+(?=[A-Z‘“(])", text)
    return [p.strip() for p in parts if p.strip()]


def main(slugs):
    for slug in slugs:
        src = BOOKS / slug / "content" / f"{slug}.html"
        w = Walker()
        w.feed(src.read_text(encoding="utf-8"))
        out = ROOT / "tmp/quotes" / slug
        out.mkdir(parents=True, exist_ok=True)
        with open(out / "paragraphs.jsonl", "w", encoding="utf-8") as f:
            for p in w.paras:
                f.write(json.dumps(p, ensure_ascii=False) + "\n")
        n = 0
        with open(out / "sentences.tsv", "w", encoding="utf-8") as f:
            for i, p in enumerate(w.paras):
                for s in sentences(p["text"]):
                    words = len(s.split())
                    if 8 <= words <= 45 and not START_BAD.match(s) and not REF.search(s[:12]):
                        f.write(f"{i}\t{p['anchor']}\t{words}\t{s}\t{'; '.join(p['refs'])}\n")
                        n += 1
        print(f"{slug}: {len(w.paras)} paragraphs, {n} candidate sentences")


if __name__ == "__main__":
    main(sys.argv[1:])
