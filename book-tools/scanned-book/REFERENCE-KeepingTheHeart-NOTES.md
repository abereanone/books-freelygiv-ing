# Keeping the Heart (John Flavel): project notes

Prepared by Michael A. Coughlin for books.freely.giving. Text: American Tract Society edition
(archive.org `keepingheartorsa00flav`, 19th c., reprinted from the 1830 Glasgow edition).

## Published 2026-11-18

- Page: https://books.freely.giving/books/john-flavel/keeping-the-heart/ (commit f48eba7)
- New person page: john-flavel (bio adapted from the DNB, 1889; portrait from the 1691 engraving, Rijksmuseum RP-P-1909-1079, CC0)
- R2: keeping-the-heart/KeepingTheHeart.pdf, KeepingTheHeart.epub, print-ready.zip
- First published 2026-11-18 at 6 x 9 (128 pages). Reset 2026-11-19 at 5 x 8 (157 pages) with BSB verse
  footnotes (tools/versenotes.py) and an evergreen cover (see C:/code/crosswords-books.md); that version
  waits in local BFG commits until Michael has the Lulu listings.
- Lulu: field sheet in cover/lulu-fields.html. TODO: when Michael sends the Lulu product link, add the
  `printBook` button (label Book, source Lulu) to book.yaml and push.

## Rebuilding

1. `npm run text` (tools/fix.py then tools/split.py: OCR fixes, Michael's spelling decisions, scan-check fixes, footnotes, glossary)
2. `npm run pdf` (dist/Keeping-the-Heart-5x8.pdf and dist/book.html), then `python -I tools/make-epub.py`
3. Cover: `node cover/make-cover.cjs --trim=5x8` then `python -I tools/fix-cover-size.py cover/cover-lulu.pdf` (page count from dist/print-facts.json);
   print-ready parts are in dist/zip5/
4. Copy into C:/code/books-freelygiv-ing/data/src/books/keeping-the-heart/content/ (inline-html.py for the HTML),
   `npm run upload -- keeping-the-heart --force` in the BFG repo.

Decisions: spelling-decisions.md. Scan check: check/REPORT.md.
