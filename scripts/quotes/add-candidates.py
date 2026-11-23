"""Turn picked sentences into candidate quotes in data/src/books/<slug>/quotes.yaml.

    python scripts/quotes/extract.py <slug>          # first: tmp/quotes/<slug>/paragraphs.jsonl
    python scripts/quotes/add-candidates.py <slug>   # reads tmp/quotes/<slug>/picks.yaml

picks.yaml rows are [paragraph, starts with, ends with, topics, scripture]. The quote text is
cut from the paragraph between those two fragments, so it is always word-for-word as printed.
Quotes already in quotes.yaml (same id) keep their status and any edits; new ones are added
as `candidate`. Rejected quotes stay in the file so they are never proposed again.
"""
import sys
from datetime import date
from common import BOOKS, WORK, load_yaml, dump_yaml, book, first_author, paragraphs, slugify

HEADER = """# Quotes from this book, for quote cards and /quotes/. See docs/QUOTES-SPEC.md.
# status: candidate (not yet reviewed) | approved (on the site) | rejected (never shown, never re-proposed)
# text is verbatim from our edition; scripts/quotes/verify.py checks it against the Read Online HTML.
"""


def main(slug):
    b = book(slug)
    author = first_author(b)
    last = author.split("-")[-1]
    paras = paragraphs(slug)
    picks = load_yaml(WORK / slug / "picks.yaml", [])
    out_file = BOOKS / slug / "quotes.yaml"
    existing = {q["id"]: q for q in load_yaml(out_file, [])}
    added, problems = 0, []
    for para, start, end, topics, scripture in picks:
        p = paras[para]
        t = p["text"]
        i = t.find(start)
        j = t.find(end, i) if i >= 0 else -1
        if i < 0 or j < 0:
            problems.append(f"para {para}: could not find {start!r} ... {end!r}")
            continue
        text = t[i:j + len(end)]
        qid = f"{last}-{slugify(text)}"
        if qid in existing:
            continue
        existing[qid] = {
            "id": qid,
            "text": text,
            "author": author,
            "book": slug,
            "chapter": p["chapter"],
            "anchor": p["anchor"],
            "topics": topics,
            "scripture": scripture,
            "words": len(text.split()),
            "status": "candidate",
            "featured": False,
            "background": None,
            "added": date.today().isoformat(),
        }
        added += 1
    dump_yaml(list(existing.values()), out_file, HEADER)
    print(f"{slug}: {added} added, {len(existing)} in quotes.yaml")
    for x in problems:
        print("  PROBLEM", x)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        main(s)
