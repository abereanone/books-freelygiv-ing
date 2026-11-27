"""EPUB 3 from dist/book.html (the web edition). Run: node tools/build.mjs  then  python -I tools/make-epub.py
Adapted from C:/code/Psalm119Devotional/tools/make-epub.py. Footnotes become pop-up notes
(epub:type noteref/footnote). One file per section; chapters III and IV list their sections in the TOC."""
import re, uuid, zipfile, datetime, copy, sys, os, site
sys.path.append(site.getusersitepackages())
from lxml import html, etree

TITLE, AUTHOR = 'Keeping the Heart', 'John Flavel'
COVER = 'cover/cover-front.jpg'
UIDURL = 'https://books.freely.giving/books/john-flavel/keeping-the-heart/'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'dist/Keeping-the-Heart.epub'
root = html.parse('dist/book.html').getroot()
xml = lambda e: etree.tostring(e, method='xml', encoding='unicode', with_tail=False)
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
esc = lambda s: s.replace('&', '&amp;').replace('<', '&lt;')

secs = [('title', 'titlepage', root.xpath('//section[@class="title-page"]')[0])]
for el in root.xpath('//section[@id] | //nav[@id="contents"]'):
    secs.append(('contents' if el.get('id') == 'contents' else 'sec', el.get('id'), el))
fname = lambda kind, i: {'title': 'title.xhtml', 'contents': 'contents.xhtml'}.get(kind, i + '.xhtml')

def label(kind, i, el):
    if kind == 'title': return 'Title Page'
    if i == 'copyright': return 'Copyright'
    num = el.xpath('.//p[@class="chapter-num"]')
    h = el.xpath('.//h2')
    t = norm(h[0].text_content()) if h else i
    return (norm(num[0].text_content()).replace('Chapter ', '') + '. ' + t) if num else t

idfile = {}
for kind, i, el in secs:
    for e in el.iter():
        if e.get('id'): idfile[e.get('id')] = fname(kind, i)
    idfile[i] = fname(kind, i)

HEAD = ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" '
        'xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en"><head><meta charset="utf-8"/>'
        '<title>{t}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>')

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
    t = label(kind, i, el)
    subs = [(h.get('id'), norm(h.text_content())) for h in el.xpath('.//h3[@id]')]
    files.append((fname(kind, i), i, kind, t, subs, HEAD.format(t=esc(t)) + s + ''.join(notes) + '</body></html>'))

items = [(f, t, subs) for f, i, kind, t, subs, _ in files if kind == 'sec']
navhtml = '<ol>' + ''.join('<li><a href="%s">%s</a>%s</li>' % (f, esc(t), ('<ol>' + ''.join('<li><a href="%s#%s">%s</a></li>' % (f, sid, esc(st)) for sid, st in subs) + '</ol>') if subs else '') for f, t, subs in items) + '</ol>'
nav = (HEAD.format(t='Contents') + '<nav epub:type="toc" id="toc"><h1>Contents</h1>' + navhtml + '</nav>'
       '<nav epub:type="landmarks" hidden="hidden"><ol><li><a epub:type="cover" href="cover.xhtml">Cover</a></li>'
       '<li><a epub:type="bodymatter" href="epistle-dedicatory.xhtml">Start</a></li></ol></nav></body></html>')
uid = 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, UIDURL))
flat = []
for f, t, subs in items:
    flat.append((f, t)); flat += [(f + '#' + sid, st) for sid, st in subs]
ncx = ('<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head>'
       '<meta name="dtb:uid" content="%s"/></head><docTitle><text>%s</text></docTitle><navMap>' % (uid, TITLE)
       + ''.join('<navPoint id="n%d" playOrder="%d"><navLabel><text>%s</text></navLabel><content src="%s"/></navPoint>' % (k, k + 1, esc(t), f) for k, (f, t) in enumerate(flat))
       + '</navMap></ncx>')
css = '''body{font-family:serif;line-height:1.45;margin:0 .6em}h1,h2,h3{font-family:serif;line-height:1.2;page-break-after:avoid}
p{margin:0;text-indent:1.2em}h2+p,h3+p,blockquote+p,.copyright p,.title-page p,.glossary p{text-indent:0}
.copyright p,.glossary p{margin:0 0 .6em}.chapter-num{text-align:center;text-transform:uppercase;letter-spacing:.1em;font-size:.8em;margin:2em 0 0}
.chapter-title,.matter-title{text-align:center;margin:.2em 0 1em;font-weight:normal}h3{text-align:center;font-size:1.05em;margin:1.4em 0 .5em}
blockquote{margin:1em 1.5em;font-style:italic}blockquote cite{display:block;text-align:right;font-style:normal}
.tp-title{text-align:center;margin-top:2em;font-weight:normal}.tp-sub{text-align:center;font-style:italic}.tp-author{text-align:center;font-variant:small-caps;letter-spacing:.1em;font-size:1.15em}
.salutation{text-align:center;font-size:.85em;margin:0 1em 1em}.signoff{text-align:right}
a.fn-call{font-size:.7em;vertical-align:super;line-height:0;text-decoration:none}aside{font-size:.85em}.fg-badge{text-align:center}.fg-badge img{width:60%}
.toc-list,.toc-list ol{list-style:none;padding-left:0}.toc-subs{padding-left:1.2em}.toc-pg{display:none}
.pl{font-size:.7em;vertical-align:.35em;line-height:0}'''
cover = (HEAD.format(t='Cover') + '<div style="text-align:center"><img src="cover.jpg" alt="Cover of Keeping the Heart by John Flavel" '
         'style="max-width:100%;max-height:100%"/></div></body></html>')
mani = [('cover.xhtml', 'application/xhtml+xml', 'cv'), ('nav.xhtml', 'application/xhtml+xml', 'nav'), ('style.css', 'text/css', 'css'),
        ('cover.jpg', 'image/jpeg', 'img'), ('fg_standard_pd.svg', 'image/svg+xml', 'svg'), ('toc.ncx', 'application/x-dtbncx+xml', 'ncx')]
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
desc = 'John Flavel’s classic on keeping the heart with God in every condition of life, from the American Tract Society text, with footnotes and a glossary for old words.'
opf = ('<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="en">'
       '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
       '<dc:identifier id="uid">%s</dc:identifier><dc:title>%s</dc:title><dc:creator>%s</dc:creator><dc:language>en</dc:language>'
       '<dc:publisher>Books.Freely.Giving</dc:publisher><dc:contributor>Michael A. Coughlin</dc:contributor>'
       '<dc:rights>Text in the public domain; this edition dedicated to the public domain (CC0).</dc:rights>'
       '<dc:subject>Puritan</dc:subject><dc:subject>Christian life</dc:subject><dc:description>%s</dc:description>'
       '<meta property="dcterms:modified">%s</meta><meta name="cover" content="img"/></metadata><manifest>' % (uid, TITLE, AUTHOR, desc, now)
       + ''.join('<item id="%s" href="%s" media-type="%s"%s/>' % (k, h, m, ' properties="nav"' if k == 'nav' else ' properties="cover-image"' if k == 'img' else '') for h, m, k in mani)
       + ''.join('<item id="f%d" href="%s" media-type="application/xhtml+xml"/>' % (n, f[0]) for n, f in enumerate(files))
       + '</manifest><spine toc="ncx"><itemref idref="cv"/>' + ''.join('<itemref idref="f%d"/>' % n for n in range(len(files))) + '</spine></package>')
D = zipfile.ZIP_DEFLATED
with zipfile.ZipFile(OUT, 'w') as z:
    z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', zipfile.ZIP_STORED)
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>', D)
    z.writestr('OEBPS/content.opf', opf, D); z.writestr('OEBPS/nav.xhtml', nav, D); z.writestr('OEBPS/toc.ncx', ncx, D)
    z.writestr('OEBPS/style.css', css, D); z.writestr('OEBPS/cover.xhtml', cover, D)
    z.write(COVER, 'OEBPS/cover.jpg'); z.write('front/fg_standard_pd.svg', 'OEBPS/fg_standard_pd.svg')
    for f, i, kind, t, subs, x in files: z.writestr('OEBPS/' + f, x, D)
print(OUT, len(files), 'content files,', sum(x.count('epub:type="footnote"') for *_, x in files), 'footnotes')
