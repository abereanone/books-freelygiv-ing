"""Check every quotes.yaml. Exit 1 on any problem.

    python scripts/quotes/verify.py            # all books with a quotes.yaml
    python scripts/quotes/verify.py <slug>...

Checks: text is word-for-word in the book's Read Online HTML; the anchor exists there;
1-3 topics, all in data/src/quotes/topics.yaml; every Scripture reference is a real verse
(checked against the site's BSB); the author has an era in eras.yaml; ids are unique.
"""
import subprocess, sys
from common import ROOT, BOOKS, QDATA, WORK, load_yaml, paragraphs, norm, bible, check_ref

STATUSES = {"candidate", "approved", "rejected"}


def main(slugs):
    topics = load_yaml(QDATA / "topics.yaml", {})
    eras = load_yaml(QDATA / "eras.yaml", {})
    meta, verses = bible()
    if not slugs:
        slugs = sorted(p.parent.name for p in BOOKS.glob("*/quotes.yaml"))
    seen, errors, counts = {}, [], {s: 0 for s in STATUSES}
    for slug in slugs:
        if not (WORK / slug / "paragraphs.jsonl").exists():
            subprocess.run([sys.executable, str(ROOT / "scripts/quotes/extract.py"), slug], check=True, capture_output=True)
        body = " \n ".join(norm(p["text"]) for p in paragraphs(slug))
        hf = BOOKS / slug / "content" / f"{slug}.html"
        html = hf.read_text(encoding="utf-8") if hf.exists() else ""   # EPUB/PDF-only books have no anchors
        for q in load_yaml(BOOKS / slug / "quotes.yaml", []):
            where = f"{slug}/{q.get('id')}"
            err = lambda m: errors.append(f"{where}: {m}")
            if q["id"] in seen:
                err(f"duplicate id (also in {seen[q['id']]})")
            seen[q["id"]] = slug
            if q.get("status") not in STATUSES:
                err(f"status must be one of {sorted(STATUSES)}")
            else:
                counts[q["status"]] += 1
            if q.get("status") == "rejected":
                continue
            if norm(q["text"]) not in body:
                err("text not found word-for-word in the book")
            if q.get("book") != slug:
                err(f"book should be {slug}")
            if q.get("author") not in eras:
                err(f"author {q.get('author')!r} has no era in eras.yaml")
            if q.get("anchor") and html and f'id="{q["anchor"]}"' not in html:
                err(f"anchor #{q['anchor']} not in the Read Online HTML")
            t = q.get("topics") or []
            if not 1 <= len(t) <= 3:
                err("needs 1-3 topics")
            for x in t:
                if x not in topics:
                    err(f"unknown topic {x!r}")
            for r in q.get("scripture") or []:
                m = check_ref(r, meta, verses)
                if m:
                    err(m)
            if not 5 <= len(q["text"].split()) <= 50:
                err("text should be 5-50 words")
    for e in errors:
        print("ERROR", e)
    print(f"{len(seen)} quotes in {len(slugs)} books: " + ", ".join(f"{v} {k}" for k, v in counts.items())
          + f"; {len(errors)} problem(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
