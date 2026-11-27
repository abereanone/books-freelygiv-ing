"""Prepare the page-by-page scan check: check/pages/nN.md holds the text that should appear on
scan page N (source/pages/nN.jpg). Paragraphs are marked with the scan page they start on, so a
page gets its own paragraphs plus the last paragraph begun on an earlier page (which may run onto it).
Usage: python -I tools/check-prep.py
"""
import re, os

t = open('source/fixed.md', encoding='utf-8').read()
paras = []
for chunk in re.split(r'\n\n(?=<!-- s\d+ -->)', t):
    m = re.match(r'<!-- s(\d+) -->\n', chunk)
    if m:
        paras.append((int(m.group(1)), chunk[m.end():].strip()))
os.makedirs('check/pages', exist_ok=True)
os.makedirs('check/results', exist_ok=True)
os.makedirs('check/claims', exist_ok=True)
for n in range(11, 199):
    own = [p for s, p in paras if s == n]
    before = [p for s, p in paras if s < n]
    carry = before[-1:] if before else []
    body = ''
    if carry:
        body += '[Paragraph begun on an earlier page; only its end may be on this page:]\n\n' + carry[0] + '\n\n'
    body += ('[Paragraphs that begin on this page:]\n\n' + '\n\n'.join(own)) if own else '[No paragraph begins on this page.]'
    open(f'check/pages/n{n}.md', 'w', encoding='utf-8', newline='\n').write(body + '\n')
print('excerpts written for scan pages 11-198')
