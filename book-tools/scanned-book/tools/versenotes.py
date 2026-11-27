"""Add a footnote with the verse text (Michael's modified BSB) to every Scripture reference that the book
cites but does not quote. Flavel's own quotations stay as he gave them (KJV). Decided 2026-11-19.
Runs on text/*.md after tools/gloss.py (tools/split.py calls it). Usage: python -I tools/versenotes.py
"""
import json, re, glob, os, sys

BSB = json.load(open('c:/code/confession/shared/data/bsb.json', encoding='utf-8'))
MAX_VERSES = 4   # a longer passage is left as a reference only

NAMES = {'gen': 'Gen|Genesis', 'exo': 'Exod?|Exodus', 'lev': 'Lev|Leviticus', 'num': 'Numb?|Numbers', 'deu': 'Deut|Deuteronomy',
         'jos': 'Josh|Joshua', 'jdg': 'Judg|Judges', 'rut': 'Ruth', 'sa': 'Sam|Samuel', 'ki': 'Kings', 'ch': 'Chron|Chronicles',
         'ezr': 'Ezra', 'neh': 'Neh|Nehemiah', 'est': 'Esth|Esther', 'job': 'Job', 'psa': 'Psalms?|Psal|Psa|Ps',
         'pro': 'Prov|Proverbs', 'ecc': 'Eccles|Eccl|Ecclesiastes', 'sng': 'Cant|Song', 'isa': 'Isa|Isai|Isaiah',
         'jer': 'Jer|Jeremiah', 'lam': 'Lam|Lamentations', 'ezk': 'Ezek|Ezekiel', 'dan': 'Dan|Daniel', 'hos': 'Hos|Hosea',
         'jol': 'Joel', 'amo': 'Amos', 'oba': 'Obad', 'jon': 'Jonah', 'mic': 'Mic|Micah', 'nah': 'Nah|Nahum', 'hab': 'Hab|Habakkuk',
         'zep': 'Zeph', 'hag': 'Hag', 'zec': 'Zech|Zechariah', 'mal': 'Mal|Malachi', 'mat': 'Matth|Matt|Mat|Matthew',
         'mrk': 'Mark', 'luk': 'Luke', 'jhn': 'John', 'act': 'Acts', 'rom': 'Rom|Romans', 'co': 'Cor|Corinthians',
         'gal': 'Gal|Galatians', 'eph': 'Ephes|Eph|Ephesians', 'php': 'Phil|Philippians', 'col': 'Col|Colossians',
         'th': 'Thess|Thessalonians', 'ti': 'Tim|Timothy', 'tit': 'Tit|Titus', 'phm': 'Philem', 'heb': 'Heb|Hebrews',
         'jas': 'James|Jam', 'pe': 'Pet|Peter', 'jud': 'Jude', 'rev': 'Rev|Revelation'}
NUMBERED = {'sa', 'ki', 'ch', 'co', 'th', 'ti', 'pe'}
alts = sorted(((n, c) for c, ns in NAMES.items() for n in ns.split('|')), key=lambda x: -len(x[0]))
lookup = dict(alts)
RX = re.compile(r'(?:\b([123])\s)?\b(' + '|'.join(re.escape(n) for n, _ in alts) +
                r')\.?,?\s+(\d{1,3}):(\d{1,3})((?:\s?[-–]\s?\d{1,3}(?![:\d]))?(?:,\s?\d{1,3}(?![:\d])(?:\s?[-–]\s?\d{1,3}(?![:\d]))?)*)')

def book(num, name):
    c = lookup[name]
    if name == 'John':
        return {'1': '1jn', '2': '2jn', '3': '3jn'}.get(num, 'jhn')
    return (num or '1') + c if c in NUMBERED else c

def verses(code, ch, first, rest):
    nums = [first]
    rest = rest or ''
    lead = re.match(r'\s?[-–]\s?(\d{1,3})', rest)   # "7–23": a range starting at the first verse
    if lead:
        nums += list(range(first + 1, int(lead.group(1)) + 1))
        rest = rest[lead.end():]
    for part in re.findall(r'\d{1,3}\s?[-–]\s?\d{1,3}|\d{1,3}', rest):
        if re.search(r'[-–]', part):
            a, b = map(int, re.split(r'\s?[-–]\s?', part))
            nums += list(range(a if a != nums[-1] else a + 1, b + 1))
        else:
            nums.append(int(part))
    chap = BSB.get(code, [])
    if not (1 <= ch <= len(chap)):
        return None
    out = []
    for v in nums:
        hit = next((x for x in chap[ch - 1] if x['verse'] == v), None)
        if not hit:
            return None
        out.append((v, hit['text']))
    return out

def quoted(t, s, e):
    before, after = t[max(0, s - 6):s], t[e:e + 6]
    return '”' in before or '“' in after

n_total = 0
for f in sorted(glob.glob('text/*.md')):
    if f.endswith('90-glossary.md'):
        continue
    t = open(f, encoding='utf-8').read()
    out, notes, pos, k = [], [], 0, 0
    for m in RX.finditer(t):
        line_start = t.rfind('\n', 0, m.start()) + 1
        if t[line_start:line_start + 2] in ('[^', '##', '> ', '--') or t.rfind('<!--', 0, m.start()) > t.rfind('-->', 0, m.start()):
            continue
        if quoted(t, m.start(), m.end()) or t[m.end():m.end() + 2] == '[^':
            continue
        try:
            code = book(m.group(1), m.group(2))
        except KeyError:
            continue
        vs = verses(code, int(m.group(3)), int(m.group(4)), m.group(5))
        if not vs or len(vs) > MAX_VERSES:
            continue
        k += 1
        label = f'v{k}'
        out.append(t[pos:m.end()] + f'[^{label}]')
        pos = m.end()
        text = vs[0][1] if len(vs) == 1 else ' '.join(f'<sup>{v}</sup>{x}' for v, x in vs)
        notes.append(f'[^{label}]: {m.group(0).strip()} — {text}')
    if not notes:
        continue
    t = ''.join(out) + t[pos:]
    t = t.rstrip('\n') + '\n\n' + '\n\n'.join(notes) + '\n'
    open(f, 'w', encoding='utf-8', newline='\n').write(t)
    n_total += len(notes)
print(n_total, 'verse footnotes added')
