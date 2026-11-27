"""Turn source/pages.json into one running text: source/raw.md.

Drops running heads, page numbers and printer's marks; joins paragraphs across pages
(a paragraph with no first-line indent at the top of a page continues the last one);
joins words split at line ends (¬ = soft break, - = real hyphen); marks centred lines as
headings (## ...). Page numbers of the printed book are kept as <!-- p.N --> markers so
the text can be checked against the scan.
Usage: python -I tools/assemble.py
"""
import json, re

pages = json.load(open('source/pages.json', encoding='utf-8'))
HEAD = re.compile(r'^[\W\d]*(KEEP|KEET|EPISTLE|INTRODUC|THE DUTY|REASONS|SPE|STE|APPLICATION|THESE DOUBTS|\'ll IE|JOHN FLA)', re.I)

STAMP = re.compile(r'^\W*Kee?pp?\.? ?Heart\.?', re.I)

def is_furniture(par, pg):
    text = ' '.join(l['text'] for l in par['lines']).strip()
    if len(re.findall(r'[A-Za-z]', text)) < 3:
        return True
    if len(par['lines']) == 1 and par['lines'][0]['t'] / pg['h'] < 0.075 and len(text) <= 30:
        return True
    top = par['lines'][0]['t'] / pg['h']
    bot = par['lines'][-1]['b'] / pg['h']
    if len(par['lines']) == 1 and top < 0.12 and (HEAD.match(text) or len(text) <= 6):
        return True
    if len(par['lines']) == 1 and bot > 0.9 and len(text) <= 6:   # signature marks, stray numbers
        return True
    return False

# find the first body page: the Epistle Dedicatory heading
start = next(i for i, pg in enumerate(pages) if any('TO MY DEARLY BELOVED' in l['text'] for p in pg['pars'] for l in p['lines']))
start -= 1
paras = []  # list of [kind, text]

def join_lines(lines):
    s = ''
    for ln in lines:
        t = ln['text'].strip()
        if not s:
            s = t
        elif s.endswith('¬'):
            s = s[:-1] + t
        elif s.endswith('-') and not s.endswith('--'):
            s = s + t
        else:
            s = s + ' ' + t
    return s

def ends_open(s):
    s = s.rstrip().rstrip('*').rstrip()
    return not re.search(r'[.?!:;”’)\]—]$', s) or s.endswith(',')

for pi in range(start, len(pages)):
    pg = pages[pi]
    for par in pg['pars']:   # library stamp / garbled running head at the start of a line
        par['lines'] = [dict(l, text=STAMP.sub('', l['text']).lstrip(' *0123456789')) if STAMP.match(l['text']) else l for l in par['lines']]
        par['lines'] = [l for l in par['lines'] if l['text'].strip()]
    body = [p for p in pg['pars'] if p['lines'] and not is_furniture(p, pg)]
    first = True
    for par in body:
        text = join_lines(par['lines'])
        if not text.strip():
            continue
        if par['align'] == 'Center' and len(text) < 120:
            paras.append(['h', text, pi])
        elif paras and paras[-1][0] == 'p' and ((first and par['indent'] <= 0) or ends_open(paras[-1][1])):
            prev = paras[-1][1]
            if prev.endswith('¬'):
                paras[-1][1] = prev[:-1] + text
            elif prev.endswith('-'):
                paras[-1][1] = prev + text
            else:
                paras[-1][1] = prev + ' ' + text
        else:
            paras.append(['p', text, pi])
        first = False

# the book ends with "Amen."; drop scanner noise after it
last = max(i for i, p in enumerate(paras) if p[1].rstrip().endswith('Amen.') or 'Amen.' in p[1][-30:])
paras = paras[:last + 1]
paras[-1][1] = paras[-1][1][:paras[-1][1].rindex('Amen.') + 5]

with open('source/raw.md', 'w', encoding='utf-8', newline='\n') as f:
    for kind, text, pi in paras:
        text = re.sub(r'\s+', ' ', text).strip()
        f.write(f'<!-- s{pi} -->\n' + (f'## {text}' if kind == 'h' else text) + '\n\n')
print(len(paras), 'paragraphs from scan page', start)
