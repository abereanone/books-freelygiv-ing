"""Find likely OCR errors in source/raw.md by checking against two other scans of the work
(source/ref-1826.txt, source/ref-1830.txt) and a dictionary.

For each word: if the 3-word run (prev, word, next) never appears in the reference texts but
the references do have (prev, X, next) with X close to the word, propose X. Words that are in
neither the dictionary nor the references are listed too.
Usage: python -I tools/check.py  ->  source/suspects.tsv
"""
import re, sys, site, collections
sys.path.append(site.getusersitepackages())
from spellchecker import SpellChecker

def words(t):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", t.lower())

def load_ref(p):
    t = open(p, encoding='utf-8', errors='replace').read()
    t = re.sub(r'[¬-]\s*\n\s*', '', t)
    return words(t)

ref = load_ref('source/ref-1826.txt') + load_ref('source/ref-1830.txt')
vocab = collections.Counter(ref)
tri = set(zip(ref, ref[1:], ref[2:]))
ctx = collections.defaultdict(collections.Counter)
for a, b, c in zip(ref, ref[1:], ref[2:]):
    ctx[(a, c)][b] += 1
sp = SpellChecker()

def close(a, b):
    if a == b: return False
    if abs(len(a) - len(b)) > 2: return False
    # simple edit distance
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (ca != cb))
    return d[-1] <= 2

text = open(sys.argv[1] if len(sys.argv) > 1 else 'source/raw.md', encoding='utf-8').read()
text = re.sub(r'<!--.*?-->', '', text)
w = words(text)
out = collections.OrderedDict()
for i in range(len(w)):
    word = w[i]
    prev = w[i - 1] if i else ''
    nxt = w[i + 1] if i + 1 < len(w) else ''
    key = None
    if (prev, word, nxt) not in tri:
        cands = [c for c, n in ctx.get((prev, nxt), {}).items() if close(word, c)]
        if cands:
            key = (word, max(cands, key=lambda c: ctx[(prev, nxt)][c]), 'context')
    if not key and word not in vocab and not sp.known([word]) and len(word) > 1:
        sug = sp.correction(word) or ''
        key = (word, sug, 'unknown')
    if key:
        k = key[:2]
        if k not in out:
            out[k] = [key[2], 0, ' '.join(w[max(0, i - 4):i + 5])]
        out[k][1] += 1
with open('source/suspects.tsv', 'w', encoding='utf-8', newline='\n') as f:
    for (word, sug), (kind, n, ex) in out.items():
        f.write(f'{word}\t{sug}\t{kind}\t{n}\t{ex}\n')
print(len(out), 'suspects;', sum(1 for v in out.values() if v[0] == 'context'), 'from context')
