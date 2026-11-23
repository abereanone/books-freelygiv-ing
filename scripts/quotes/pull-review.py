"""Copy decisions from the phone review page back into each book's quotes.yaml.

The phone page is a private claude.ai artifact (https://claude.ai/artifact/YaxZqYdHPRLRjssPvFQVKa)
whose database holds one document per quote. Claude exports it with ArtifactData `list`
(collection "quotes", out_dir tmp/quotes/phone-review/pulled), then:

    python scripts/quotes/pull-review.py [tmp/quotes/phone-review/pulled]

Copies status, topics, scripture, featured, tone (which look shows first) and the two
paintings (background: {dark, light}). The quote text is never taken from the page.
Run scripts/quotes/verify.py afterwards.
"""
import json, sys
from pathlib import Path
from common import BOOKS, WORK, load_yaml, dump_yaml

HEADER = """# Quotes from this book, for quote cards and /quotes/. See docs/QUOTES-SPEC.md.
# status: candidate (not yet reviewed) | approved (on the site) | rejected (never shown, never re-proposed)
# text is verbatim from our edition; scripts/quotes/verify.py checks it against the Read Online HTML.
# tone: the look shown first (light | dark); both are made. background: the painting for each.
"""
FIELDS = ("status", "topics", "scripture", "featured", "tone")


def main(src):
    docs = {}
    for f in Path(src).rglob("*.json"):
        d = json.loads(f.read_text(encoding="utf-8"))
        body = d.get("data", d)
        docs[d.get("id") or f.stem] = body
    changed = 0
    for qf in sorted(BOOKS.glob("*/quotes.yaml")):
        quotes = load_yaml(qf, [])
        n = 0
        for q in quotes:
            d = docs.get(q["id"])
            if not d:
                continue
            new = {k: d[k] for k in FIELDS if k in d}
            new["background"] = {"dark": d.get("bgDark"), "light": d.get("bgLight")}
            for k, v in new.items():
                if q.get(k) != v:
                    q[k] = v
                    n += 1
        if n:
            dump_yaml(quotes, qf, HEADER)
            print(f"{qf.parent.name}: {n} field(s) updated")
            changed += n
    counts = {}
    for d in docs.values():
        counts[d.get("status")] = counts.get(d.get("status"), 0) + 1
    print(f"{len(docs)} quotes on the page: " + ", ".join(f"{v} {k}" for k, v in sorted(counts.items())) + f"; {changed} change(s) written")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else WORK / "phone-review" / "pulled")
