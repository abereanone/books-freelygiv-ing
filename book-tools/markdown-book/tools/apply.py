# Apply exact replacements to a chapter: python tools/apply.py chapters/NN-*.md < edits
# edits format:   <<<\nold text\n===\nnew text\n>>>   (repeat). Each old text must occur exactly once.
import sys, glob
path = glob.glob(sys.argv[1])[0]
s = open(path, encoding='utf8').read()
sys.stdin.reconfigure(encoding='utf-8'); sys.stdout.reconfigure(encoding='utf-8')
spec = sys.stdin.read()
n = 0
for block in spec.split('<<<\n')[1:]:
    old, rest = block.split('\n===\n', 1)
    new = rest.rsplit('\n>>>', 1)[0]
    c = s.count(old)
    if c != 1:
        sys.exit(f'FAILED ({c} matches) in {path}:\n{old[:200]}')
    s = s.replace(old, new); n += 1
open(path, 'w', encoding='utf8', newline='\n').write(s)
print(f'{path}: {n} edits')
