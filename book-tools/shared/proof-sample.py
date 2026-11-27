"""The proofreading sheet: every sentence of the edition scored for the slips scanned books carry, then
the riskiest 15% (at most) and a random 5% of the rest written out to be read in full against the scan.

The policy is Courtney Hicks's (colophon proof/, decided with his editor 2026-10-25), adopted
2026-11-27; his scores come from a language model, these from rules that need nothing installed:
  - he/be where the grammar wants the other ("to he", "be saith"), and OCR words (tbe, tlie, aud, hut)
  - a word found once in the book, unknown to the BSB, that a classic OCR confusion turns into a
    word the book uses (rn/m, li/h, cl/d, ii/u, vv/w, h/b, fi/fl)
  - letters and figures mixed in a word, a space before . , ; : ? !, a doubled word, a paragraph
    whose quotation marks do not pair
Usage, from the book's folder:
  python -I C:/code/books-freelygiv-ing/book-tools/shared/proof-sample.py "text/*.md" -o check/read.md [--seed N]
"""
import argparse, collections, glob, json, random, re

BSB = "C:/code/confession/shared/data/bsb.json"
SWAPS = [("rn", "m"), ("m", "rn"), ("li", "h"), ("h", "li"), ("cl", "d"), ("d", "cl"), ("ii", "u"),
         ("vv", "w"), ("h", "b"), ("b", "h"), ("fi", "fl"), ("fl", "fi")]
B = r"\b"
HE_BE = [(re.compile(B + r"(to|shall|will|may|might|must|should|would|can|cannot|let)\s+he" + B + r"(?!\?)", re.I), "he: be?"),
         (re.compile(B + r"be\s+(saith|said|hath|had|doth|did|was|is|says|answered|replied)" + B, re.I), "be: he?"),
         (re.compile(B + r"(hut|tbe|tlie|aud|arid|tbat|liis|witb|wbo|bim|tliat|wliich|wlien|iu)" + B), "OCR word")]
DOUBLED = re.compile(B + r"(\w+)\s+\1" + B, re.I)


def variants(w):
    for a, b in SWAPS:
        i = w.find(a)
        while i != -1:
            yield w[:i] + b + w[i + len(a):]
            i = w.find(a, i + 1)


def bsb_words():
    try:
        data = json.load(open(BSB, encoding="utf-8"))
    except OSError:
        return set()
    words = set()
    def walk(x):
        if isinstance(x, str):
            words.update(w.lower() for w in re.findall(r"[A-Za-z]+", x))
        elif isinstance(x, dict):
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(data)
    return words


def clean(t):
    t = re.sub(r"(?ms)^---\n.*?\n---\s*$", " ", t)
    t = re.sub(r"<!--.*?-->", " ", t, flags=re.S)
    t = re.sub(r"(?m)^\[\^v\d+\]:.*$", " ", t)   # BSB verse notes (versenotes.py): generated from bsb.json
    t = re.sub(r"(?m)^\[\^[^\]]+\]:", " ", t)
    t = re.sub(r"\[\^[^\]]+\]", "", t)
    t = re.sub(r"(?m)^\s{0,3}[#>]+\s?", "", t)
    return re.sub(r"[*_]+", "", t)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("edition", nargs="+"); a.add_argument("-o", "--out", required=True)
    a.add_argument("--seed", type=int, default=None); a.add_argument("--top", type=float, default=0.15)
    a.add_argument("--random", type=float, default=0.05)
    o = a.parse_args()
    seed = o.seed if o.seed is not None else random.randrange(10 ** 6)
    files = [f for pat in o.edition for f in sorted(glob.glob(pat))]
    sents = []                                   # (file, sentence, paragraph's quotes pair)
    for f in files:
        for para in re.split(r"\n\s*\n", clean(open(f, encoding="utf-8").read())):
            para = " ".join(para.split())
            paired = para.count("\u201c") == para.count("\u201d")
            parts = [s for s in re.split(r"(?<=[.!?\u201d])\s+(?=[\u201c\"(A-Z])", para) if len(s.split()) >= 3]
            for k, s in enumerate(parts):
                sents.append((f, s, paired or k < len(parts) - 1))
    freq = collections.Counter(w.lower() for _, s, _ in sents for w in re.findall(r"[A-Za-z]+", s))
    known = bsb_words()
    scored = []
    for n, (f, s, paired) in enumerate(sents):
        why = [f"{m.group(0)} ({label})" for rx, label in HE_BE for m in rx.finditer(s)]
        for w in re.findall(r"[A-Za-z0-9]+", s):
            lw = w.lower()
            if re.search(r"[A-Za-z]\d|\d[A-Za-z]", w) and not re.fullmatch(r"\d+(st|nd|rd|th|s|d)", w):
                why.append(f"{w} (letters and figures)")
            elif w.isalpha() and freq[lw] == 1 and lw not in known:
                near = [v for v in variants(lw) if freq[v] >= 2]
                if near:
                    why.append(f"{w} -> {near[0]}?")
        if re.search(r"\s[.,;:?!]", s): why.append("space before punctuation")
        if DOUBLED.search(s): why.append(f"doubled word: {DOUBLED.search(s).group(0)}")
        if not paired: why.append("this paragraph's quotation marks do not pair")
        scored.append((len(why), n, f, s, why))
    rng = random.Random(seed)
    flagged = sorted((x for x in scored if x[0]), key=lambda x: (-x[0], x[1]))
    top = flagged[:max(1, int(len(scored) * o.top))]
    chosen = {x[1] for x in top}
    rest = [x for x in scored if x[1] not in chosen]
    sample = sorted(rng.sample(rest, min(len(rest), int(len(scored) * o.random))), key=lambda x: x[1])
    with open(o.out, "w", encoding="utf-8", newline="\n") as out:
        out.write(f"# Proofreading sheet\n\n{len(scored)} sentences in {len(files)} files. Read each one against "
                  f"the scan; note every slip found.\n\n## Flagged ({len(top)} of {len(flagged)} with a flag)\n\n")
        for _, _, f, s, why in sorted(top, key=lambda x: x[1]):
            out.write(f"- [ ] `{f}`: {s}\n  - {'; '.join(why)}\n")
        out.write(f"\n## Random {o.random:.0%} of the rest (seed {seed})\n\n")
        for _, _, f, s, _ in sample:
            out.write(f"- [ ] `{f}`: {s}\n")
    print(f"{o.out}: {len(top)} flagged + {len(sample)} random of {len(scored)} sentences (seed {seed})")


if __name__ == "__main__":
    main()
