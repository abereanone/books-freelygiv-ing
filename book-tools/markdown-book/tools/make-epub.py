"""EPUB 3 from dist/book.html (the web edition). Run: node tools/build.mjs  then  python tools/make-epub.py
Footnotes become pop-up notes (epub:type noteref/footnote). One file per chapter, part page, and matter."""
import re, uuid, zipfile, datetime, copy, sys, json, os
from lxml import html, etree
# Another language: book.config.json may hold an "epub" block overriding these (see es/book.config.json). Run from the edition's folder.
E = {'lang': 'en', 'title': 'Meditations on Psalm 119', 'author': 'Michael A. Coughlin',
     'cover': 'C:/code/books-freelygiv-ing/data/src/books/meditations-on-psalm-119/content/cover.jpg',
     'uid': 'https://books.freely.giving/books/michael-coughlin/meditations-on-psalm-119/',
     'rights': 'Dedicated to the public domain (CC0). Scripture: Berean Standard Bible (public domain).',
     'subjects': ['Psalm 119', 'Devotional', 'Scripture memory'],
     'description': '44 weekly meditations on Psalm 119, one for each set of four verses, with the verses printed in full (Berean Standard Bible).',
     'titlePage': 'Title Page', 'contents': 'Contents', 'coverLabel': 'Cover', 'start': 'Start', 'copyrightLabel': 'Copyright',
     'coverAlt': 'Cover of Meditations on Psalm 119', 'out': 'dist/Meditations-on-Psalm-119.epub'}
if os.path.exists('book.config.json'):
    E.update(json.load(open('book.config.json', encoding='utf-8')).get('epub', {}))
SRC = 'dist/book.html'; COVER = E['cover']
OUT = sys.argv[1] if len(sys.argv) > 1 else E['out']
TITLE, AUTHOR = E['title'], E['author']
root = html.parse(SRC).getroot()
xml = lambda e: etree.tostring(e, method='xml', encoding='unicode', with_tail=False)
norm = lambda s: re.sub(r'\s+', ' ', s).strip()

secs = []
for el in root.xpath('//section[@id] | //nav[@id="contents"]'):
    i = el.get('id')
    if i == 'contents': kind = 'contents'
    elif i in ('copyright', 'dedication', 'introduction', 'afterword', 'about', 'index'): kind = i
    elif re.fullmatch(r'part\d+', i): kind = 'part'
    elif re.fullmatch(r'ch\d+', i): kind = 'ch'
    else: continue
    secs.append((kind, i, el))
tp = root.xpath('//section[@class="title-page"]')[0]
secs.insert(0, ('title', 'titlepage', tp))

def fname(kind, i):
    return {'title': 'title.xhtml', 'contents': 'contents.xhtml'}.get(kind, i + '.xhtml')

def label(kind, i, el):
    if kind == 'title': return E['titlePage']
    if kind == 'ch':
        t = el.xpath('.//h2[@class="chapter-title"]')[0].text_content()
        return i[2:] + '. ' + norm(t)
    h = el.xpath('.//h2[@class="matter-title"]')
    if h: return norm(h[0].text_content())
    return {'copyright': E['copyrightLabel']}.get(kind, kind.title())

idfile = {}
for kind, i, el in secs:
    for e in el.iter():
        if e.get('id'): idfile[e.get('id')] = fname(kind, i)
    idfile[i] = fname(kind, i)

parttitle = {}
for li in root.xpath('//li[@class="toc-part"]'):
    a = li.xpath('./a')[0]; pid = a.get('href')[1:]
    parttitle[pid] = norm(re.sub(r'^\S\s+', '', a.text_content()))

HEAD = ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" '
        'xmlns:epub="http://www.idpf.org/2007/ops" lang="%s" xml:lang="%s"><head><meta charset="utf-8"/>'
        '<title>{t}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>') % (E['lang'], E['lang'])
esc = lambda s: s.replace('&', '&amp;')

files = []
for kind, i, el in secs:
    el = copy.deepcopy(el)
    notes = []
    for lab in el.xpath('.//label[@class="fn-call"]'):
        n = lab.text
        inp = lab.getnext(); body = inp.getnext()
        num = body.xpath('.//span[@class="fn-num"]')[0]; num.getparent().remove(num)
        inner = (body.text or '') + ''.join(xml(c) + (c.tail or '') for c in body)
        notes.append('<aside epub:type="footnote" id="fn%s"><p><a href="#fnref%s">%s.</a> %s</p></aside>' % (n, n, n, inner.strip()))
        a = etree.Element('a'); a.set('href', '#fn' + n); a.set('id', 'fnref' + n); a.set('class', 'fn-call'); a.set('data-noteref', '1'); a.text = n; a.tail = lab.tail
        par = lab.getparent(); par.remove(inp); par.remove(body); par.replace(lab, a)
    for a in el.xpath('.//a[@href]'):
        h = a.get('href')
        if h.startswith('#') and h[1:] in idfile and not h.startswith('#fn'):
            tgt = idfile[h[1:]]
            a.set('href', h if tgt == fname(kind, i) else tgt + h)
    s = xml(el).replace('data-noteref="1"', 'epub:type="noteref"').replace(' xmlns="http://www.w3.org/1999/xhtml"', '')
    t = parttitle.get(i, i) if kind == 'part' else label(kind, i, el)
    files.append((fname(kind, i), i, kind, t, HEAD.format(t=esc(t)) + s + ''.join(notes) + '</body></html>'))

nav_items = []; cur = None
for f, i, kind, t, _ in files:
    if kind == 'part':
        cur = [f, t, []]; nav_items.append(cur)
    elif kind == 'ch' and cur:
        cur[2].append((f, t))
    else:
        nav_items.append((f, t))

def navhtml():
    o = ['<ol>']
    for x in nav_items:
        if isinstance(x, tuple):
            if x[0] in ('title.xhtml', 'contents.xhtml'): continue
            o.append('<li><a href="%s">%s</a></li>' % (x[0], esc(x[1])))
        else:
            o.append('<li><a href="%s">%s</a><ol>' % (x[0], esc(x[1])) + ''.join('<li><a href="%s">%s</a></li>' % (f, esc(t)) for f, t in x[2]) + '</ol></li>')
    return ''.join(o) + '</ol>'

nav = (HEAD.format(t=E['contents']) + '<nav epub:type="toc" id="toc"><h1>' + E['contents'] + '</h1>' + navhtml() + '</nav>'
       '<nav epub:type="landmarks" hidden="hidden"><ol><li><a epub:type="cover" href="cover.xhtml">' + E['coverLabel'] + '</a></li>'
       '<li><a epub:type="bodymatter" href="introduction.xhtml">' + E['start'] + '</a></li></ol></nav></body></html>')
uid = 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, E['uid']))
flat = []
for x in nav_items:
    if isinstance(x, tuple):
        if x[0] not in ('title.xhtml', 'contents.xhtml'): flat.append(x)
    else:
        flat.append((x[0], x[1])); flat += x[2]
ncx = ('<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head>'
       '<meta name="dtb:uid" content="%s"/></head><docTitle><text>%s</text></docTitle><navMap>' % (uid, TITLE)
       + ''.join('<navPoint id="n%d" playOrder="%d"><navLabel><text>%s</text></navLabel><content src="%s"/></navPoint>' % (k, k + 1, esc(t), f) for k, (f, t) in enumerate(flat))
       + '</navMap></ncx>')
css = '''body{font-family:serif;line-height:1.45;margin:0 .6em}h1,h2,h3{font-family:serif;line-height:1.2;page-break-after:avoid}
.chapter-num{text-align:center;text-transform:uppercase;letter-spacing:.1em;font-size:.8em;margin:2em 0 0}.chapter-title{text-align:center;margin:.1em 0}.chapter-ref{text-align:center;font-style:italic;margin:0 0 1em}
.opener{margin:1em 0;padding:.2em 1em;border-left:3px solid #999}.opener p{margin:.5em 0}sup{font-size:.7em}blockquote{margin:1em 0 1em 1em;padding-left:.8em;border-left:2px solid #bbb}
.tp-title,.ht,.tp-author,.tp-glyph{text-align:center}.tp-glyph{font-size:3em;margin-top:2em}.tp-author{font-size:1.2em}.part{text-align:center;margin-top:3em}.part h2,.part p{text-align:center}
a.fn-call{font-size:.7em;vertical-align:super;line-height:0;text-decoration:none}aside{font-size:.85em}.fg-badge{text-align:center}.fg-badge img{width:60%}
.ix-book{margin:1em 0 .2em;font-size:1.05em}.ix-ch{margin:.1em 0;font-size:.85em}.ix-chn{font-weight:bold}.toc-list{list-style:none;padding-left:0}
.pl{font-size:.7em;vertical-align:.35em;line-height:0}'''
cover = (HEAD.format(t=E['coverLabel']) + '<div style="text-align:center"><img src="cover.jpg" alt="' + E['coverAlt'] + '" '
         'style="max-width:100%;max-height:100%"/></div></body></html>')
mani = [('cover.xhtml', 'application/xhtml+xml', 'cv'), ('nav.xhtml', 'application/xhtml+xml', 'nav'), ('style.css', 'text/css', 'css'),
        ('cover.jpg', 'image/jpeg', 'img'), ('fg_standard_pd.svg', 'image/svg+xml', 'svg'), ('toc.ncx', 'application/x-dtbncx+xml', 'ncx')]
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
subj = ''.join('<dc:subject>%s</dc:subject>' % x for x in E['subjects'])
opf = ('<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="%s">'
       '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
       '<dc:identifier id="uid">%s</dc:identifier><dc:title>%s</dc:title><dc:creator>%s</dc:creator><dc:language>%s</dc:language>'
       '<dc:publisher>Books.Freely.Giving</dc:publisher>'
       '<dc:rights>%s</dc:rights>%s<dc:description>%s</dc:description>'
       '<meta property="dcterms:modified">%s</meta><meta name="cover" content="img"/></metadata><manifest>' % (E['lang'], uid, TITLE, AUTHOR, E['lang'], E['rights'], subj, E['description'], now)
       + ''.join('<item id="%s" href="%s" media-type="%s"%s/>' % (k, h, m, ' properties="nav"' if k == 'nav' else ' properties="cover-image"' if k == 'img' else '') for h, m, k in mani)
       + ''.join('<item id="f%d" href="%s" media-type="application/xhtml+xml"/>' % (n, f[0]) for n, f in enumerate(files))
       + '</manifest><spine toc="ncx"><itemref idref="cv"/>' + ''.join('<itemref idref="f%d"/>' % n for n in range(len(files))) + '</spine></package>')
D = zipfile.ZIP_DEFLATED
with zipfile.ZipFile(OUT, 'w') as z:
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', zipfile.ZIP_STORED)
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', D)
    z.writestr('OEBPS/content.opf', opf, D); z.writestr('OEBPS/nav.xhtml', nav, D); z.writestr('OEBPS/toc.ncx', ncx, D)
    z.writestr('OEBPS/style.css', css, D); z.writestr('OEBPS/cover.xhtml', cover, D)
    z.write(COVER, 'OEBPS/cover.jpg'); z.write('dist/fg_standard_pd.svg', 'OEBPS/fg_standard_pd.svg')
    for f, i, kind, t, x in files: z.writestr('OEBPS/' + f, x, D)
print(OUT, len(files), 'content files,', sum(x.count('epub:type="footnote"') for *_, x in files), 'footnotes')
