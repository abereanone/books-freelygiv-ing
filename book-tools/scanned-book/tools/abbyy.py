"""Parse the archive.org ABBYY OCR XML into source/pages.json.

Each page: list of paragraphs {indent, align, lines:[{l, t, b, text, low}]}.
Italic runs are wrapped in *...*. `low` lists words with poor OCR confidence.
Usage: python -I tools/abbyy.py source/abbyy.gz source/pages.json
"""
import gzip, json, sys
import xml.etree.ElementTree as ET

src, out = sys.argv[1], sys.argv[2]
NS = ''
pages, cur_page, cur_par = [], None, None

def tag(e):
    return e.tag.split('}')[-1]

for ev, el in ET.iterparse(gzip.open(src, 'rb'), events=('start', 'end')):
    t = tag(el)
    if ev == 'start':
        if t == 'page':
            cur_page = {'w': int(el.get('width')), 'h': int(el.get('height')), 'pars': []}
        elif t == 'par':
            cur_par = {'indent': int(el.get('startIndent', 0)), 'left': int(el.get('leftIndent', 0)),
                       'align': el.get('align', ''), 'lines': []}
        continue
    if t == 'line':
        text, low, word, wconf, it_open = '', [], '', [], False
        l = int(el.get('l')); tp = int(el.get('t')); b = int(el.get('b'))
        for f in el:
            if tag(f) != 'formatting':
                continue
            ital = f.get('italic') == 'true' or f.get('italic') == '1'
            chars = [c for c in f if tag(c) == 'charParams']
            seg = ''
            for c in chars:
                ch = c.text or ' '
                seg += ch
                if ch.strip():
                    word += ch
                    wconf.append(int(c.get('charConfidence', 100)))
                    if c.get('wordFromDictionary') == '0' and c.get('wordFirst') == '1':
                        pass
                else:
                    if word and wconf and min(wconf) < 40:
                        low.append(word)
                    word, wconf = '', []
            if ital and seg.strip():
                lead = seg[:len(seg) - len(seg.lstrip())]
                trail = seg[len(seg.rstrip()):]
                seg = f'{lead}*{seg.strip()}*{trail}'
            text += seg
        if word and wconf and min(wconf) < 40:
            low.append(word)
        text = text.replace('**', '')
        cur_par['lines'].append({'l': l, 't': tp, 'b': b, 'text': text, 'low': low})
        el.clear()
    elif t == 'par':
        if cur_par['lines']:
            cur_page['pars'].append(cur_par)
        el.clear()
    elif t == 'page':
        pages.append(cur_page)
        el.clear()

json.dump(pages, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(pages), 'pages')
