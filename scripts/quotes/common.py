"""Shared helpers for the quote scripts."""
import json, re, unicodedata
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "data/src/books"
QDATA = ROOT / "data/src/quotes"
WORK = ROOT / "tmp/quotes"


def load_yaml(p, default=None):
    p = Path(p)
    if not p.exists():
        return default
    return yaml.safe_load(p.read_text(encoding="utf-8")) or default


def dump_yaml(data, p, header=""):
    text = yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=10**9, default_flow_style=None)
    Path(p).write_text(header + text, encoding="utf-8", newline="\n")  # UTF-8, no BOM


def book(slug):
    return load_yaml(BOOKS / slug / "book.yaml", [{}])[0]


def first_author(b):
    for c in b.get("credits", []):
        if c.get("role") == "author":
            return c.get("person") or c.get("name")
    return None


def paragraphs(slug):
    f = WORK / slug / "paragraphs.jsonl"
    return [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines()]


def norm(s):
    """Compare text ignoring whitespace runs only (punctuation and spelling must match)."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s)).strip()


def slugify(s, n=5):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    words = [w for w in re.findall(r"[a-z]+", s) if w not in {"the", "a", "an", "of", "and", "o", "oh", "is"}]
    return "-".join(words[:n])


def bible():
    meta = json.loads((ROOT / "public/bible/bible-tooltips-meta.json").read_text(encoding="utf-8"))["bookMap"]
    verses = json.loads((ROOT / "public/bible/bible-tooltips-verses.json").read_text(encoding="utf-8"))["verses"]
    return meta, verses


REF = re.compile(r"^(?P<book>(?:[123] )?[A-Z][A-Za-z ]+?) (?P<ch>\d+):(?P<v>\d+)$")


def check_ref(ref, meta, verses):
    """'Romans 8:13' -> None if the verse exists, else an error string. One verse per entry."""
    m = REF.match(ref)
    if not m:
        return f"bad reference format {ref!r} (want e.g. 'Romans 8:13', one verse each)"
    code = meta.get(m["book"].lower())
    if not code:
        return f"unknown Bible book in {ref!r}"
    if f"{code} {m['ch']}:{m['v']}" not in verses:
        return f"no such verse {ref!r}"
    return None
