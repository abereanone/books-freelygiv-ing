---
name: sync-freely-given
description: Pull Courtney Hicks's Freely Given Books editions (PDF, EPUB, print-ready ZIP, Read Online, What's New?, cover, Lulu link) into this site from the newest GitHub release of freely-given-books/books. Use when the owner says Courtney has a new release, asks to sync, update or import her books, or asks to bring in one of her books.
---

# Sync Courtney's books

Courtney Hicks (he) prepares editions of classic books in
[freely-given-books/books](https://github.com/freely-given-books/books). Each
GitHub release there carries every signed-off book's files plus a `site.json`
written for this site. `scripts/sync-freely-given.js` does the mechanical
part: it downloads and checksums the files, writes them into `content/` under
this site's stable names, and updates `book.yaml`. Your job is to run it,
deal with what it can't decide, and hand the R2 upload to the owner.

Read `CLAUDE.md` and `docs/BOOK-FILES.md` first if you haven't this session.

## 1. Look before writing

```bash
npm run sync:fgb -- --dry-run                 # newest release
npm run sync:fgb -- --dry-run --release TAG   # a particular one
npm run sync:fgb -- --dry-run <slug> <slug>   # only these site pages
```

Give the owner the plan in a few lines: which books are new, which are
updated, anything flagged. The owner wants this to take as little of their
time as possible, so **don't stop to ask** when everything is an update with
no problems: go straight on to step 2. Stop and ask only when a book is new
(step 3), or the script printed `PROBLEM:` or `CHECK:` lines.

### Problems go back to Courtney

Courtney (he) publishes the releases. The script checks every edition (files
present, real PDF/EPUB/HTML, listed in `SHA256SUMS`, title not garbled, slug
not a duplicate of an existing page, no dead links in the HTML). An edition with a
`PROBLEM:` is **not imported at all**; the rest still sync. `CHECK:` items
are imported but worth his attention.

Whenever it prints `FILE TO SEND BACK TO COURTNEY`, that file
(`_downloads/freely-given/for-courtney.md`) is the message for him: what is
wrong, per book and file, and what the sync needs. Tell the owner the path and
that it is ready to send. Don't edit it, don't fix his files here, and don't
work around a problem by hand-editing `book.yaml` or `content/`. Once he
re-releases, run the sync again; it only changes what's different. The same
file can carry an "Optional" note: new books arrive complete when his
`site.json` has `year`, `description` and `tags` for them.

## 2. Sync

```bash
npm run sync:fgb            # or with the same --release / slugs as above
```

For every site page in the release (a book in volumes is one page per
volume, `<slug>-volume-N`) the script:

- writes `<slug>.pdf`, `<slug>.epub`, `print-ready.zip` (the interior and the
  Lulu cover PDF), `<slug>.html` (Read Online), `<slug>-whats-new.html`
  (What's New?) and `cover.jpg` into `data/src/books/<slug>/content/`, with
  the HTML pages' links pointed at those names
- in `book.yaml`, sets `pages` and the Read Online, What's New?, eBook, PDF
  and Print Ready buttons, in the order Pilgrim's Progress shows them; adds a
  Book (Lulu) button only where there is none (an existing one is the
  owner's and is never changed); and adds the
  `courtney-hicks` / `prepared: true` credit if it's missing. Title,
  description, tags, year, `addedDate` and any other buttons (audiobook,
  mobi, and so on) are left alone.
- records what it wrote in `data/freely-given-sync.json`. A second run
  changes nothing until a release changes a file.

## 3. What the script leaves to you

Its output flags each of these:

- **NEW (hidden)**: a book not on the site yet gets a `book.yaml` with
  `hidden: true`, `year: null`, and the release summary as its description.
  The summary describes the edition, so it isn't a good blurb for readers.
  Ask the owner for the year of first publication and a description. Offer
  to draft one from the book's opening pages, as the other books' blurbs
  are. Ask too whether the author gets a person page
  (`data/src/<person-slug>/person.yaml` and a photo) or stays name-only
  (`name:`), and what the tags are. A volume's title comes out as
  "Title, Volume II", as Gouge's are. Remove `hidden: true` only when the
  owner says so.
- **Read Online stays at …**: the owner's Read Online button points at
  another site (the 1689 Confession points at confess.catechize.ing), so the
  script kept it. Courtney's `<slug>.html` is staged in `content/` but not
  linked. Ask whether to switch.
- **NOTE from the editor**: Courtney's instruction for that book's import
  (say, that it replaces another edition). Follow it, and tell the owner
  about anything it asks of R2.
- **other buttons left as they are**: these are fine unless a note says
  otherwise.

A big drop in `pages` is expected when a new edition is set more tightly.
Mention it, but it isn't an error.

## 4. Check and commit

```bash
npm run build      # must pass; it also refreshes the OG cards
git status         # review: content/*.html, cover.jpg, book.yaml, the sync record, OG cards
```

Look at one updated book page in `npm run dev` if the owner wants to see it.
Commit to `main` as `CLAUDE.md` says: the book YAML, the covers, the HTML
pages, `data/freely-given-sync.json` and the regenerated OG cards. Never
commit PDFs, EPUBs or ZIPs (`.gitignore` excludes them) or `_downloads/`.
Ask before pushing.

## 5. The owner uploads

The script ends with the line to run, for example:

```bash
npm run upload -- the-pilgrims-progress all-of-grace --force
```

`--force` is needed because the files replace ones already in R2. Don't run
it yourself, and don't ask for the R2 keys. The owner runs it, then pushes.
Downloads can show the old file for a few minutes until the CDN cache
expires.

## When it goes wrong

- **"release … has no site.json"**: that release predates the sync. Use a
  newer one; the script writes the file to send back to Courtney (he).
- **"checksum does not match SHA256SUMS"**: a download was cut short, or the
  release changed. Delete `_downloads/freely-given/<tag>/` and run it again.
  If it keeps failing it lands in the file for Courtney.
- **GitHub rate limit (403)**: set `GITHUB_TOKEN` (any token, no scopes) and
  run it again.
- **A slug isn't the one the site uses**: Courtney sets the site's slug in
  his repository (`books/publishing.toml`, `slug = "..."`). The script
  catches a new book whose title matches an existing page under another slug and
  reports it in the file for him. Don't rename anything here.
