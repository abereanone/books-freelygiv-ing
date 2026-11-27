"""source/raw.md -> source/fixed.md: mechanical clean-up, OCR corrections, Michael's text decisions.

1. Mechanical: italics split at line ends, stray spaces before punctuation (decision 5), "0" for "O".
2. Context corrections: a word that differs from the reference scans (1826, 1830) by one easily
   confused letter (h/b, n/u, y/v...) is corrected only where the references have the corrected
   word between the same two neighbours.
3. Hand corrections: tools/fixes.tsv (find<TAB>replace, exact text, applied in order).
4. Decisions: today/tomorrow, modern compounds (tools/compounds.tsv).
Usage: python -I tools/fix.py
"""
import re, collections

# pairs the references would wrongly 'correct' (the ATS editor's own wording)
SKIP = {('spoke','spake'),('it','lt'),('come','came'),('showed','shewed'),('these','those'),('if','it'),('you','yon'),('broke','brake'),('now','mow'),('overrigid','oyerrigid')}
CONFUSE = {frozenset(p) for p in ['hb', 'nu', 'yv', 'ce', 'il', 'tf', 'ao', 'ec', 'rn', 'ft', 'li', 'jp', 'sa', 'oe', 'tl', 'mn', 'ij', 'kh', 'yu']}

def words(t):
    return re.findall(r"[a-z]+", t.lower())

def load_ref(p):
    t = open(p, encoding='utf-8', errors='replace').read()
    return words(re.sub(r'[¬-]\s*\n\s*', '', t))

ref = load_ref('source/ref-1826.txt') + load_ref('source/ref-1830.txt')
tri = set(zip(ref, ref[1:], ref[2:]))
ctx = collections.defaultdict(set)
for a, b, c in zip(ref, ref[1:], ref[2:]):
    ctx[(a, c)].add(b)

def confusable(a, b):
    if len(a) != len(b): return False
    diff = [(x, y) for x, y in zip(a, b) if x != y]
    return len(diff) == 1 and frozenset(diff[0]) in CONFUSE

t = open('source/raw.md', encoding='utf-8').read()

# 1. mechanical
t = re.sub(r'¬\*\s*\*', '', t)            # soft break inside italics
t = t.replace('¬', '')
t = re.sub(r'\*\s+\*', ' ', t)             # adjacent italic runs
t = re.sub(r'\*([;:,.?!])\*', r'\1', t)    # italicised lone punctuation
t = re.sub(r'(?<=\w)\s+([;:?!])', r'\1', t)          # space before ; : ? !
t = re.sub(r'(?<=[\w*”’])\s+([;:?!])', r'\1', t)
t = re.sub(r'(?<=[\w*])\s+,', ',', t)
t = re.sub(r'(?<=[\w*])\s+\.(?!\.)', '.', t)
t = re.sub(r'“\s+', '“', t)
t = re.sub(r'\s+”', '”', t)
t = re.sub(r'(^|[\s“(‘])0(?=[ ,!][^\d])', r'\1O', t, flags=re.M)   # "0 my heart" -> "O my heart"
t = re.sub(r'(\d)\s*:\s*(\d)', r'\1:\2', t)          # verse refs "1 :8" -> "1:8"
t = re.sub(r' {2,}', ' ', t)
t = re.sub(r'\*, \*', ', ', t)   # *a*, *b* -> *a, b* (the scan runs the italic through the comma)
t = re.sub(r'(?<=\d)\s*[—-]\s*(?=\d)', '–', t)   # number ranges take an en dash: 40:15–17
t = re.sub(r"(?<=[A-Za-z])'(?=[A-Za-z])", '’', t)   # straight apostrophes
t = re.sub(r'\*(Help|Rule|Direction|Remedy|Means|Motive|Argument|Consideration|Question|Objection|Answer|Comfort) (\d+)\.\*', r'*\1* \2.', t)   # *Help 2.* -> *Help* 2.

# 2. context corrections (whole words, case kept)
toks = list(re.finditer(r'\b[A-Za-z]+\b', t))
lw = [m.group().lower() for m in toks]
edits, log = [], collections.Counter()
for i, m in enumerate(toks):
    w = lw[i]
    prev = lw[i - 1] if i else ''
    nxt = lw[i + 1] if i + 1 < len(lw) else ''
    if (prev, w, nxt) in tri:
        continue
    cands = [c for c in ctx.get((prev, nxt), ()) if confusable(w, c)]
    if len(cands) == 1 and (w, cands[0]) not in SKIP:
        c = cands[0]
        orig = m.group()
        new = c.capitalize() if orig[0].isupper() else c
        edits.append((m.start(), m.end(), new))
        log[(orig, new)] += 1
for s, e, new in reversed(edits):
    t = t[:s] + new + t[e:]

# 2b. words in neither the dictionary nor the reference scans: try common OCR misreadings,
#     and joining with the next word (OCR split "foun dation"). Applied only when exactly one
#     reading gives a known word.
import site, sys
sys.path.append(site.getusersitepackages())
from spellchecker import SpellChecker
sp = SpellChecker()
refvocab = set(ref)
EXTRA = {'etc', 'syllogistical', 'thattoucheth'}
known = lambda w: w in refvocab or w in EXTRA or bool(sp.known([w]))
SUBS = [('iv', 'w'), ('ic', 'w'), ('li', 'h'), ('ii', 'n'), ('rn', 'm'), ('vv', 'w'), ('cl', 'd'), ('wr', 'w'),
        ('wf', 'w'), ('wt', 'w'), ('ff', 'fr'), ('tl', 't'), ('ei', 'er'), ('i', 'r'), ('j', 'g'), ('j', 'p'),
        ('f', 't'), ('o', 'c'), ('c', 'e'), ('e', 'c'), ('d', 'cl'), ('u', 'n'), ('n', 'u'), ('h', 'b'), ('b', 'h'),
        ('y', 'v'), ('v', 'y'), ('l', 'i'), ('t', 'f'), ('i', 'l'), ("'", ''), ('q', 'g'), ('s', 'a'), ('a', 's')]

def readings(w):
    out = set()
    for a, b in SUBS:
        i = w.find(a)
        while i >= 0:
            out.add(w[:i] + b + w[i + len(a):])
            i = w.find(a, i + 1)
    return {r for r in out if known(r)}

log2 = collections.Counter()
def join_hyphen(m):
    a, b = m.group(1), m.group(2)
    j = (a + b).lower()
    if known(j) and (not known(a.lower()) or not known(b.lower())):
        log2[(a + '-' + b, a + b)] += 1
        return a + b
    return m.group()
t = re.sub(r'\b([A-Za-z]+)-([a-z]+)\b', join_hyphen, t)

def join_split(m):
    a, b = m.group(1), m.group(2)
    if known(a.lower()) and known(b.lower()):
        return m.group()
    j = (a + b).lower()
    if known(j):
        log2[(a + ' ' + b, a + b)] += 1
        return a + b
    return m.group()
t = re.sub(r'\b([A-Za-z]+) ([a-z]+)\b', join_split, t)

def repl_word(m):
    w = m.group()
    lw_ = w.lower()
    if known(lw_) or len(lw_) < 4:
        return w
    r = readings(lw_)
    if len(r) == 1:
        new = r.pop()
        new = new.capitalize() if w[0].isupper() else new
        log2[(w, new)] += 1
        return new
    return w
t = re.sub(r"\b[A-Za-z][A-Za-z']*\b", repl_word, t)

# 3. hand corrections
for line in open('tools/fixes.tsv', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'):
        continue
    a, b = (x.replace('\\n', '\n') for x in line.split('\t'))
    n = t.count(a)
    if n == 0:
        print('FIX NOT FOUND:', a)
    t = t.replace(a, b)

# 4. decisions
for a, b in [('to-day', 'today'), ('To-day', 'Today'), ('to-morrow', 'tomorrow'), ('To-morrow', 'Tomorrow')]:
    t = t.replace(a, b)
for line in open('tools/compounds.tsv', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'):
        continue
    a, b = line.split('\t')
    t = re.sub(r'\b' + re.escape(a) + r'\b', b, t)
    t = re.sub(r'\b' + re.escape(a.capitalize()) + r'\b', b[0].upper() + b[1:], t)

# 5. page-by-page scan check corrections (tools/check-apply.py writes this file)
import os
if os.path.exists('tools/fixes-scan.tsv'):
    for line in open('tools/fixes-scan.tsv', encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.startswith('#'):
            continue
        a, b = line.split('\t')[:2]
        if a not in t:
            print('SCAN FIX NOT FOUND:', a)
        t = t.replace(a, b)

open('source/fixed.md', 'w', encoding='utf-8', newline='\n').write(t)
with open('source/context-fixes.log', 'w', encoding='utf-8', newline='\n') as f:
    for (a, b), n in log.most_common():
        f.write(f'{a}\t{b}\t{n}\n')
    f.write('# OCR misreadings and split words\n')
    for (a, b), n in log2.most_common():
        f.write(f'{a}\t{b}\t{n}\n')
print(len(edits), 'context corrections; see source/context-fixes.log')
