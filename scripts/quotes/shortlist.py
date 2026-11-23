"""Rank a book's candidate sentences and keep the most quotable, for a person to read.

    python scripts/quotes/shortlist.py <slug> [--n 120]

Reads tmp/quotes/<slug>/sentences.tsv (from extract.py), writes tmp/quotes/<slug>/shortlist.txt
as "paragraph|sentence" lines in book order. The score favours short, balanced, self-contained
lines (a contrast, a semicolon or colon, a memorable image) about the things people share
quotes about, and drops lines that lean on what came before or are mostly Scripture citation.
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

KW = re.compile(r"\b(God|Christ|Jesus|Lord|Spirit|sin|sins|soul|souls|heart|hearts|grace|faith|love|Satan|devil|pray\w*|afflict\w*|mercy|mercies|holy|holiness|heaven|hell|death|die|world|pride|proud|humble|humility|saints?|gospel|providence|comfort|fear|trouble|riches|poor|duty|conscience|temptations?|lusts?|repent\w*|pardon|glory|cross|Scripture|word|truth|joy|peace|hope|wife|husband|children|parents)\b", re.I)
BAD = re.compile(r"(remed(y|ies) against|device of Satan,? is|following|that follow|I shall|as I said|as was|hereafter|above|before mentioned|this discourse|the text\b|chapter|verse|this head|thirdly|fourthly|fifthly|first,|secondly|objection|answer\.|ver\.|viz\.|etc\.|i\. e\.|&c)", re.I)
LEAN = re.compile(r"^(this|these|those|it|they|them|thus|such|and|but|so|for|or|nor|yet|which|that|he|she|his|her|here|there|now|then|again|also|lastly|hence|therefore|wherefore|whereas|besides|moreover|o\b|oh\b|ah\b|\(?\d+|[ivxl]+[.)])", re.I)
REF = re.compile(r"\b\d+\s*:\s*\d+")


def score(s, words):
    sc = 0.0
    if 10 <= words <= 26: sc += 2
    elif words <= 34: sc += 1
    sc += min(len(KW.findall(s)), 3)
    if re.search(r"[;:]", s): sc += 1.5
    if re.search(r"\b(not|no|never)\b.*\bbut\b|\bbut\b|\bthan\b|\bmore\b.*\bthan\b", s, re.I): sc += 1.5
    if re.search(r"\b(is|are) (a|an|the)\b", s): sc += 0.5          # definitions: "Affliction is a pill"
    if s.count("“") + s.count('"') >= 2: sc -= 1.5                    # mostly a quotation
    if REF.search(s): sc -= 2
    if "?" in s[-2:]: sc -= 1
    return sc


def main(slug, n):
    rows = [l.rstrip("\n").split("\t") for l in open(ROOT / "tmp/quotes" / slug / "sentences.tsv", encoding="utf-8")]
    keep = []
    for para, anchor, words, s, _refs in rows:
        words = int(words)
        if anchor in ("front", "copyright", "contents", "toc") or not 8 <= words <= 34:
            continue
        if LEAN.match(s) or BAD.search(s) or not KW.search(s) or not s.rstrip()[-1:] in ".!”’":
            continue
        keep.append((score(s, words), int(para), s))
    keep.sort(key=lambda x: -x[0])
    top = sorted(keep[:n], key=lambda x: x[1])
    out = ROOT / "tmp/quotes" / slug / "shortlist.txt"
    out.write_text("".join(f"{p}|{s}\n" for _, p, s in top), encoding="utf-8")
    print(f"{slug}: {len(top)} of {len(keep)} kept")


if __name__ == "__main__":
    args = sys.argv[1:]
    n = int(args[args.index("--n") + 1]) if "--n" in args else 120
    for slug in [a for a in args if not a.startswith("--") and not a.isdigit()]:
        main(slug, n)
