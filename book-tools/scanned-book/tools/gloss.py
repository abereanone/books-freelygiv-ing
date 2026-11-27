"""Footnote each word in tools/glossary.tsv at its first use in the book (text/*.md, in order),
and write the alphabetical glossary to text/90-glossary.md. Michael's decision 7 (2026-11-18).

glossary.tsv: term<TAB>gloss. A term may carry context to pick the right sense: put the glossed
word in brackets, e.g. "gifts and [parts]"; only the bracketed word is footnoted and listed.
Run by tools/split.py after the chapter files are written.
"""
import re, glob

files = sorted(f for f in glob.glob('text/*.md') if not f.endswith('90-glossary.md'))
texts = {f: open(f, encoding='utf-8').read() for f in files}

def allowed(t, i):
    line_start = t.rfind('\n', 0, i) + 1
    line = t[line_start:t.find('\n', i) if t.find('\n', i) >= 0 else len(t)]
    if line.startswith(('#', '[^', '---', 'title:', 'chapter:', '<!--', '> <cite>')):
        return False
    if t.rfind('<!--', 0, i) > t.rfind('-->', 0, i):
        return False
    return True

entries = []
for line in open('tools/glossary.tsv', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'):
        continue
    term, gloss = line.split('\t')
    m = re.search(r'\[(.+?)\]', term)
    word = m.group(1) if m else term
    if m:
        pat = re.escape(term[:m.start()]) + '(' + re.escape(word) + ')' + re.escape(term[m.end():])
    else:
        pat = '(' + re.escape(term) + ')'
    entries.append((word, gloss, re.compile(r'\b' + pat + r'\b', re.I)))

placed = []
notes = {f: [] for f in files}
for n, (word, gloss, rx) in enumerate(entries, 1):
    for f in files:
        t = texts[f]
        hit = next((m for m in rx.finditer(t) if allowed(t, m.start(1))), None)
        if hit:
            end = hit.end(1)
            if t[end:end + 2] in ('’s', "'s"):
                end += 2
            label = f'g{n}'
            texts[f] = t[:end] + f'[^{label}]' + t[end:]
            notes[f].append(f'[^{label}]: *{hit.group(1)}*: {gloss}.')
            placed.append((word.lower(), gloss))
            break
    else:
        print('glossary word not found in text:', word)

for f in files:
    t = texts[f].rstrip('\n')
    if notes[f]:
        t += '\n\n' + '\n\n'.join(notes[f])
    open(f, 'w', encoding='utf-8', newline='\n').write(t + '\n')

body = '\n\n'.join(f'**{w}**: {g}.' for w, g in sorted(placed, key=lambda x: x[0].replace('-', '')))
open('text/90-glossary.md', 'w', encoding='utf-8', newline='\n').write(
    '---\ntitle: "Glossary"\n---\n\nOld words and old meanings used in this book. Each is also footnoted where it first appears.\n\n' + body + '\n')
print(len(placed), 'glossary words footnoted')
