# Edition rules

The standing decisions for books Michael prepares or writes for books.freely.giving, in one place, so a
book is made start to finish without asking anything settled here. Each rule names where it came from.
When a book needs something these rules do not cover, ask Michael once, then add the answer here.
(The idea is Courtney Hicks's `EDITION-RULES.md` in freely-given-books/books, adopted 2026-11-27.)

## 1. What still goes to Michael

Only these stop a book:

1. The base text, when there is a real choice of edition.
2. The spelling and form list for an old book (section 3): one batch, defaults already marked.
3. The cover colour (an unused hue: `C:/code/crosswords-books.md`).
4. Approval to publish: a new book stays hidden on the site until he says so (2026-11-26).
5. The Lulu listing, which he makes himself.

Everything else follows these rules. A new question, once answered, becomes a rule here.

## 2. The text as printed

- **Keep a record of every change** from the scan or source: OCR fixes, spelling decisions and scan-check
  fixes stay in the book's files (`fixes.tsv`, `spelling-decisions.md`, `check/REPORT.md`), never made by
  hand in the output, so a rebuild repeats them.
- **The page image decides.** OCR and models only flag; a doubtful reading is checked on the scan
  (`check/INSTRUCTIONS.md`).
- Bible text is the BSB from `C:/code/confession/shared/data/bsb.json`, never the web (2026-10-24).

## 3. Old books: the reading edition

From Keeping the Heart (2026-11-18), the defaults for every reprint:

| | Rule |
| --- | --- |
| to-day, to-morrow | today, tomorrow |
| hyphenated compounds | modern form (deathbed, fig tree, honeycomb, stumbling block, goodwill) |
| the author's own coinages | kept, hyphens and all (heart-work, creature-comforts) |
| British spellings the edition prints | kept (fulness, Saviour, marvellous, travelling, lustre) |
| space before ; : ? ! | closed up |
| thee, thou, hath, -eth | kept, no footnote |
| archaic words | footnoted at first use only, plus a short glossary at the back |
| Scripture | the author's wording; BSB verse footnotes where the book uses them |
| copyright page | public domain (CC0), like the other BFG classics |

## 4. Michael's own writing

- Cut his hedges so the text states his view: "what I'll call", "I think", "it seems", "personally"
  (2026-11-13). Keep real caveats about what Scripture does not say.
- Never offer to soften tone, theology or culture-war statements (2026-10-24). Raise only errors,
  inconsistencies, typos, unclear references and print problems.

## 5. Typesetting and print

- **Trim:** per book, recorded in its notes (Psalm 119: 6x9 only, full and `--refs`; Flavel 5x8).
- **Lulu's margins, measured on the finished PDF** (Courtney's `print_check.py`, adopted 2026-11-27,
  `shared/print-check.py`, run by every kit's `build.mjs --pdf`): nothing within 0.5 in of the trim,
  running heads and page numbers included; the inside margin from the page count (under 60 pages
  0.5 in, 61-150 0.625 in, 151-400 1 in, 401-600 1.125 in), set by `build.mjs` itself.
- **Page faults to clear before a draft goes to Michael:** a heading left at a page's foot, a chapter
  ending on 1-4 lines (`~` lines from the check), and any footnote not on its marker's page.
- **Covers:** the spine comes from the interior's page count (`dist/print-facts.json`, written by the
  build; never typed by hand). Spine logo only when the spine is at least 0.67 in. Books Michael prepared:
  type-only front with the double-line box; his own books keep their designs. His photo is always
  `author-circle.jpg`.

## 6. Proofread

Before a book is called ready (`shared/proof-sample.py`): every flag from the checks is settled, then a
sample is read in full: the riskiest 15% of sentences by the flags, and a random 5% of the rest (its
seed in the sheet). Every Scripture quotation is checked against its verse.

## 7. Publishing

- Nothing goes to R2 or books.freely.giving until the whole book (all volumes) is ready (2026-11-20).
- English only on the site; ask before any other language (2026-11-26).
- Every new book gets 5-8 quote cards (add-book skill, 2026-11-23).
- Work split across PCs: the PC that finishes leaves the built files where the other can use them.
