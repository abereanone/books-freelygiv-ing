"""Check the Scripture references in a book's text/*.md against the local BSB (does each verse exist?),
and count which are quoted in the text and which are only cited (candidates for verse footnotes).
Usage: python -I tools/refs.py [project folder]   (run from anywhere; default: current folder)
"""
import json, re, sys, glob, os, collections

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
BSB = json.load(open('c:/code/confession/shared/data/bsb.json', encoding='utf-8'))
size = {b: {c + 1: len(vs) for c, vs in enumerate(ch)} for b, ch in BSB.items()}

NAMES = {'gen': 'Gen|Genesis', 'exo': 'Exod?|Exodus', 'lev': 'Lev|Leviticus', 'num': 'Numb?|Numbers', 'deu': 'Deut|Deuteronomy',
         'jos': 'Josh|Joshua', 'jdg': 'Judg|Judges', 'rut': 'Ruth', 'sa': 'Sam|Samuel', 'ki': 'Kings|Kin', 'ch': 'Chron|Chronicles',
         'ezr': 'Ezra', 'neh': 'Neh|Nehemiah', 'est': 'Esth|Esther', 'job': 'Job', 'psa': 'Psalms?|Psal|Psa|Ps',
         'pro': 'Prov|Proverbs', 'ecc': 'Eccles|Eccl|Ecclesiastes', 'sng': 'Cant|Song', 'isa': 'Isa|Isai|Isaiah',
         'jer': 'Jer|Jeremiah', 'lam': 'Lam|Lamentations', 'ezk': 'Ezek|Ezekiel', 'dan': 'Dan|Daniel', 'hos': 'Hos|Hosea',
         'jol': 'Joel', 'amo': 'Amos', 'oba': 'Obad', 'jon': 'Jonah', 'mic': 'Mic|Micah', 'nah': 'Nah|Nahum', 'hab': 'Hab|Habakkuk',
         'zep': 'Zeph', 'hag': 'Hag', 'zec': 'Zech|Zechariah', 'mal': 'Mal|Malachi', 'mat': 'Matth|Matt|Mat|Matthew',
         'mrk': 'Mark', 'luk': 'Luke', 'jhn': 'John', 'act': 'Acts', 'rom': 'Rom|Romans', 'co': 'Cor|Corinthians',
         'gal': 'Gal|Galatians', 'eph': 'Ephes|Eph|Ephesians', 'php': 'Phil|Philippians', 'col': 'Col|Colossians',
         'th': 'Thess|Thessalonians', 'ti': 'Tim|Timothy', 'tit': 'Tit|Titus', 'phm': 'Philem', 'heb': 'Heb|Hebrews',
         'jas': 'James|Jam', 'pe': 'Pet|Peter', 'jn': 'John', 'jud': 'Jude', 'rev': 'Rev|Revelation'}
NUMBERED = {'sa', 'ki', 'ch', 'co', 'th', 'ti', 'pe', 'jn'}
alts = []
for code, names in NAMES.items():
    for n in names.split('|'):
        alts.append((n, code))
alts.sort(key=lambda x: -len(x[0]))
BOOKRX = '|'.join(re.escape(n) for n, _ in alts)
RX = re.compile(r'(?:\b([123])\s?)?\b(' + BOOKRX + r')\.?,?\s+(\d{1,3}):\s?(\d{1,3})((?:\s?[-–,]\s?\d{1,3}(?![:\d]))*)')
lookup = {n: c for n, c in alts}

def code(num, name):
    c = lookup[name]
    if c in NUMBERED:
        return (num or '1') + c if c != 'jn' else ((num + 'jn') if num else 'jhn')
    return c

found, missing, quoted, cited = 0, [], 0, 0
for f in sorted(glob.glob(os.path.join(ROOT, 'text', '*.md'))):
    t = open(f, encoding='utf-8').read()
    for m in RX.finditer(t):
        try:
            c = code(m.group(1), m.group(2))
        except KeyError:
            continue
        ch, v = int(m.group(3)), int(m.group(4))
        vs = [v] + [int(x) for x in re.findall(r'\d+', m.group(5) or '')]
        found += 1
        ok = c in size and ch in size[c] and all(1 <= x <= size[c][ch] + 0 for x in vs if x >= v)
        if not ok:
            missing.append(f'{os.path.basename(f)}: {m.group(0)!r} -> {c} {ch}:{v}' + ('' if c in size and ch in size[c] else ' (no such chapter)'))
        before, after = t[max(0, m.start() - 6):m.start()], t[m.end():m.end() + 6]
        if '”' in before or '“' in after or '"' in before + after:
            quoted += 1
        else:
            cited += 1
print(f'{found} references; {quoted} next to a quotation, {cited} cited only (footnote candidates)')
print(f'{len(missing)} point to a verse the BSB does not have:')
for x in missing:
    print('  ', x)
