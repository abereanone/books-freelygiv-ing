"""source/fixed.md -> text/*.md, one file per part of the book, with headings.

The scan-page markers (<!-- sN -->) are kept so any paragraph can be checked against
source/scan.pdf (scan page N+1). The build drops them.
Usage: python -I tools/split.py
"""
import re, os

t = open('source/fixed.md', encoding='utf-8').read()

# ---- structural repairs ----
t = t.replace('<!-- s11 -->\nEPISTLE DEDICATORY.\n\n', '')
t = t.replace('## Your loving and faithful pastor,', '*Your loving and faithful pastor,*')
t = t.replace('JOHN Flavel.', 'JOHN FLAVEL.')
t = t.replace('From my Study at Ley, in) Slapton, Oct. 7,1667. J KEEPING THE HEART.', '*From my Study at Ley, in Slapton, Oct. 7, 1667.*')
t = t.replace('\nFrom my Study at Ley, in Slapton, Oct. 7, 1667.\n', '\n*From my Study at Ley, in Slapton, Oct. 7, 1667.*\n')
t = t.replace('## “KEEP THY HEART WITH ALL DILIGENCE; FOR OUT OF IT ARE THE ISSUES OF LIFE.”—Prov. 4:23.',
              '> “Keep thy heart with all diligence; for out of it are the issues of life.”\n> <cite>Proverbs 4:23</cite>')
t = t.replace('of direction, and of consolation. • I. Let these', 'of direction, and of consolation.\n\nI. Let these')
t = t.replace('of direction, and of consolation. I. Let these', 'of direction, and of consolation.\n\nI. Let these')
t = t.replace('\nIll I now proceed', '\nIII. I now proceed')
t = t.replace('\nIY. I shall now close', '\nIV. I shall now close')
t = t.replace('\nIY. Public Danger', '\nIV. Public Danger')
t = t.replace('\nY. Outward Straits', '\nV. Outward Straits')

def cut(start, end=None):
    i = t.index(start)
    j = t.index(end, i) if end else len(t)
    return t[i:j]

parts = [
    ('00-epistle-dedicatory', 'Epistle Dedicatory', None, cut('<!-- s11 -->\nTO MY DEARLY', '<!-- s23 -->\n## INTRODUCTION.')),
    ('01-introduction', 'Introduction', None, cut('## INTRODUCTION.', '<!-- s29 -->\n## CHAPTER I.') if '<!-- s29 -->\n## CHAPTER I.' in t else cut('## INTRODUCTION.', '## CHAPTER I.')),
    ('02-chapter-1', 'The Duty Explained', 'I', cut('## CHAPTER I.', '## CHAPTER II.')),
    ('03-chapter-2', 'Reasons for the Duty', 'II', cut('## CHAPTER II.', '## CHAPTER III.')),
    ('04-chapter-3', 'Occasions for Special Diligence', 'III', cut('## CHAPTER III.', '## CHAPTER IV.')),
    ('05-chapter-4', 'The Subject Applied', 'IV', cut('## CHAPTER IV.')),
]

SEASONS = ['Prosperity', 'Adversity', 'Zion’s Troubles', 'Public Danger and Distraction', 'Outward Straits and Wants',
           'Religious Duties', 'Injuries from Men', 'Great Provocations', 'Temptation', 'Spiritual Darkness',
           'Sufferings for Religion', 'Sickness and Death']
APPLIED = ['Warnings', 'Exhortations', 'Directions', 'Consolations']
ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

os.makedirs('text', exist_ok=True)
for slug, title, num, body in parts:
    body = re.sub(r'(<!-- s\d+ -->\n)?## (CHAPTER [IV]+\.|INTRODUCTION\.|THE DUTY EXPLAINED\.|REASONS FOR THE DUTY\.|OCCASIONS FOR SPECIAL DILIGENCE\.|THE SUBJECT APPLIED\.)\n\n', '', body)
    if num == 'III':
        for r, name in zip(ROMAN, SEASONS):
            pat = re.compile(r'\n' + r + r'\. ' + re.escape(name) + r'\. ', re.I)
            body, n = pat.subn(f'\n### {r}. {name}\n\n', body, count=1)
            if not n:
                print('season heading not found:', r, name)
    if num == 'IV':
        for r, name in zip(ROMAN, APPLIED):
            body, n = re.subn(r'\n' + r + r'\. ', f'\n### {r}. {name}\n\n', body, count=1)
            if not n:
                print('application heading not found:', r, name)
    fm = f'---\ntitle: "{title}"\n' + (f'chapter: "{num}"\n' if num else '') + '---\n\n'
    open(f'text/{slug}.md', 'w', encoding='utf-8', newline='\n').write(fm + body.strip() + '\n')
    print(slug, len(body.split()), 'words')

import runpy
runpy.run_path('tools/gloss.py')

runpy.run_path('tools/versenotes.py')
