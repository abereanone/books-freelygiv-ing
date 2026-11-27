# book-tools

Reusable kits for making new books, kept here so the finished book folders can be archived.
Each kit is a copy of a finished book's tooling (code, CSS, cover scripts, fonts), not its text.
Copy a kit into a new folder, `npm install` there, then change the book-specific values listed below.

Book projects never go in this repo. Make each in its own folder under `C:\code`; when it is published,
delete its `node_modules` and archive it to Proton Drive (`My files/Books`).

| Kit | Use for | Made from |
|---|---|---|
| booklet (in the `make-booklet` skill, `~/.claude/skills/make-booklet/template`) | Blog posts to a 4-48 page saddle-stitch booklet | *On the Election of Infants* (2026-11-13) |
| `markdown-book/` | A book written in Markdown (chapters/, front/, back/): Michael's books, modern authors | *Meditations on Psalm 119* (2026-10/11) |
| `scanned-book/` | Reprinting an old book from a scan: OCR text, fixes, spelling decisions, page-by-page scan check, BSB verse notes | *Keeping the Heart* (2026-11-18); also used for Token for Mourners, Spurgeon, Broadus |
| `author/` | Back-cover circles: Michael (`author-circle.jpg`, made from `author-gray.jpg` by `make-author-circle.py`), Spurgeon (the bearded one from Morning and Evening), Flavel, Broadus | |

Shared inputs that stay put: the BSB is `C:/code/confession/shared/data/bsb.json` (and `bsb.txt`);
other languages' Bibles and book-name packs are in `C:/code/book-translate`.

Card and cover scripts outside a book (BFG quote cards, quote-cards, michaelcoughlin.net post cards)
use the puppeteer-core in this repo's `node_modules`.

## markdown-book

- `book.config.json`: title, subtitle, author, trim, `bsbJson`/`bsbTxt`, `divineName`. Every tool reads it.
- `tools/build.mjs`: front/ + chapters/ + back/ to `dist/book.html` (web) and, with `--pdf [--trim 6x9]`, the print PDF.
- `tools/vv.mjs "Romans 10:17" "|" "John 1:12-13"`: BSB text for footnotes. `tools/verify.mjs` checks every quotation against the BSB.
- `tools/make-epub.py`: title, author, URL and cover path are set at the top.
- `cover/make-drafts.mjs` (wrap cover, `--pages=N`, `--lang=es`), `export-pdf.mjs` (Lulu PDF), `export-panels.mjs` (front/back/spine images); `lulu-fields*.html` are examples of the Lulu field sheet.
- `REFERENCE-Psalm119-NOTES.md`: the decisions, pipeline and Markdown conventions as that book used them.

## scanned-book

- Order: `abbyy.py` (OCR text) → `fix.py` (fixes.tsv, spelling decisions) → `split.py` (chapters, front matter) → `assemble.py`; `gloss.py`, `versenotes.py`, `refs.py` add the glossary and BSB footnotes.
- Book-specific values: the constants at the top of `build.mjs` (TITLE, SUBTITLE, AUTHOR, output name), `make-epub.py`, `split.py` (the book's own title-page fixes), `cover/make-cover.cjs` (title, colours).
- `compounds.tsv` and `glossary.tsv` are Keeping the Heart's; start from them, keep what fits.
- Scan check: `check-prep.py`, `check.py`, `check-apply.py`, `check-status.py`, with `check/INSTRUCTIONS.md` for the page-by-page pass.
- Cover sizing: `fix-cover-size.py cover/cover-lulu.pdf PAGES TRIM`. Logo books (CROSSWORDS strip): see `C:/code/crosswords-books.md`.
- Broadus and Spurgeon added tools on top (proof sheets, structure, pictures, small type). When those books are done, fold the general ones in here.
