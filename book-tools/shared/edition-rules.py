"""Apply the edition rules that are pure text changes to a book's finished Markdown (EDITION-RULES.md section 3),
in place, and say how many places changed. Safe to run again (a second run changes nothing).

  python shared/edition-rules.py "text/*.md"

- to-day, to-morrow, to-night (any case) -> today, tomorrow, tonight (Michael, 2026-11-27)
- a space before ; : ? ! after a word, a closing quote or bracket is closed up ("hands ;" -> "hands;").
  Spaced ellipses (". . .") and anything inside an HTML tag are left alone.
"""
import glob
import re
import sys

MODERN = re.compile(r"\b([Tt])o-(day|morrow|night)\b")
TODAY_CAPS = re.compile(r"\bTO-(DAY|MORROW|NIGHT)\b")
SPACE = re.compile(r"(?<=[A-Za-zÀ-ɏ’”)\]*_])[    ]+(?=[;:?!])")
TAG = re.compile(r"<[^>]*>")


def close_up(text):
    out, last = [], 0
    for m in TAG.finditer(text):  # leave tags (attributes) as they are
        out.append(SPACE.subn("", text[last:m.start()]))
        out.append((m.group(0), 0))
        last = m.end()
    out.append(SPACE.subn("", text[last:]))
    return "".join(s for s, _ in out), sum(n for _, n in out)


files = sorted({f for pat in sys.argv[1:] for f in glob.glob(pat)})
if not files:
    sys.exit("edition-rules: no files match " + " ".join(sys.argv[1:]))
modern = spaces = 0
for f in files:
    s = open(f, encoding="utf-8").read()
    s2, a = MODERN.subn(r"\1o\2", s)
    s2, b = TODAY_CAPS.subn(r"TO\1", s2)
    s2, c = close_up(s2)
    if s2 != s:
        open(f, "w", encoding="utf-8", newline="").write(s2)
    modern += a + b
    spaces += c
print(f"edition-rules: {len(files)} files; to-day/to-morrow/to-night modernised {modern}; spaces before ; : ? ! closed {spaces}")
