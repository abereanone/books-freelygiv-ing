# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`books.freely.giving` — a static Astro 6 site publishing free Christian books (Puritan
reprints and modern works). Deployed to Cloudflare Pages; large book files (PDF/EPUB/ZIP/MOBI)
live in Cloudflare R2, not in git.

## Commands

```bash
npm run dev        # sync-assets, then astro dev (port 4321)
npm run build      # sync-assets, then astro build → dist/
npm run sync       # copy data/src assets into public/ (covers, photos, html)
npm run og         # regenerate Open Graph cards into public/static/og/
npm run preview    # serve dist/
node add-book.js   # interactive CLI that scaffolds data/src/books/<slug>/book.yaml

npm run upload                              # push new book files to R2 (skips existing keys)
npm run upload -- <slug>                    # one book only
npm run upload -- <slug> --force            # overwrite an existing R2 object (required for replacements)
```

There are no tests, linter, or typecheck script. `.prettierignore` exists but Prettier is not
a dependency — formatting is by hand/editor.

`npm run upload` needs a `.env` at the project root with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_KEY`, `R2_BUCKET` (never committed).

## Content pipeline

Books and people are plain YAML on disk, not an Astro content collection. Three stages:

1. **`data/src/`** is the source of truth.
   - `data/src/<person-slug>/author.yaml` or `contributor.yaml` + a photo file.
   - `data/src/books/<book-slug>/book.yaml` + `content/` (cover image, optional HTML, and
     the PDF/EPUB/ZIP staging copies).
   - Each YAML file holds a **one-element array**, not a bare mapping — `src/lib/data.js`
     calls `readYamlArray` and ignores anything that isn't an array.
2. **`scripts/sync-assets.js`** copies covers, HTML, and person photos from `data/src/` into
   `public/static/{books,images}/`. It runs automatically as part of `dev` and `build`. It
   deliberately does *not* copy epub/pdf/zip — those are R2's job. Those `public/static/`
   destinations are gitignored (a handful of older files are still tracked).
3. **`src/lib/data.js`** reads `data/src/` at build time via `process.cwd()` (not
   `import.meta.url` — Vite rewrites that during `astro build` and breaks path resolution).
   `getBooks()`, `getAuthors()`, `getContributors()`, and `getBookAuthorPairs()` are the only
   data entry points; pages import from here rather than touching the filesystem.

`getBookDirs()` supports two layouts: the current `data/src/books/<slug>/` and a legacy
`data/src/<person-slug>/<book-slug>/` (any directory containing a `book.yaml`).
`scripts/upload-to-r2.js` additionally scans a third, older `freely-given-books-data/data/src/`
tree if present locally.

## Open Graph cards

`scripts/build-og.js` composites a 1200×630 card per book and per person into
`public/static/og/`, plus four montages for /library, /recently-added, /authors and
/contributors. It runs as part of `dev` and `build`, after `sync-assets` (it reads covers
and photos out of `public/`, so the order matters).

Social sites crop `og:image` to ~1.91:1, which decapitates a portrait book cover — hence
the card, which sets the cover beside the title rather than letting it be cropped. It also
rescues the eleven covers that are only 384px wide.

**The generated cards and `manifest.json` are committed.** Cloudflare's Linux builders have
no Georgia, so regenerating there would silently restyle every card; with the cards present
and their signatures matching, the build step is a no-op on CI. A card rebuilds when its
signature changes — the text on it, its source image's mtime, or the script's own mtime — so
after retitling a book or adding one, commit the regenerated cards. `npm run og -- --force`
rebuilds everything, which is what you want after editing the layout.

## Book YAML shape

Key fields: `title`, `sortTitle` (drives A–Z grouping on /library), `authors` (list of author
**slugs**; multiple allowed), `contributors` (list of contributor slugs), `year`, `pages`,
`addedDate` (drives /recently-added), `tags`, `license`, `path` (`/static/books/<slug>`),
`cover` (filename relative to `path`), and `mediaTypes`.

`hidden: true` removes a book from the entire site — its own page, every listing, the
sitemap, and the OG montages — while leaving the YAML intact. The filter lives only in
`getBooks()` (`src/lib/data.js`), so nothing can leak a hidden book. Remove the line to
bring it back.

`mediaTypes` entries are `{ type, label, sources: [{ name, url }] }`. The `type` values in
actual use are `htmlBook`, `pdfBook`, `eBook` (epub), `mobi`, `printBook`, `printReady`,
`audiobook`, `wordDoc`.

`type` is what selects the button colour and icon, so a new type must be added in three places
or it silently falls back to a plain blue button with no icon:
`src/pages/books/[authorSlug]/[bookSlug].astro` (`btnClass`), `src/components/FormatIcon.astro`
(the icon), and `src/pages/library.astro` (`typeConfig`, which also orders the filter buttons).

**One entry per button group, and sources decide the shape.** A `mediaTypes` entry with a
single source renders as a plain button labelled with `label`; an entry with two or more
renders as a dropdown, with each `source.name` an item inside it. That is why the Spanish
edition of *The Divine Name* is its own `htmlBook` entry rather than a second source — as a
source it would have read "Read Online (Leer en línea)". The dropdown opens on hover on
pointer devices and on click everywhere, so touch and keyboard still work.

R2-hosted downloads are absolute URLs at `https://files.books.freelygiv.ing/<slug>/<file>`.
The upload script uses the filename verbatim as the R2 key, so the file in `content/` and the
URL in `book.yaml` must match exactly, capitalisation included. See `docs/BOOK-FILES.md` for
the full add/replace workflow and troubleshooting.

## Site conventions

- **Domains.** The repo folder is `books-freelygiv-ing`, but the canonical site is
  **`books.freely.giving`** (`astro.config.mjs` default; `books.freelygiv.ing` 301s to it).
  `SITE_URL` overrides `site` so preview deploys build a preview-scoped sitemap — leave it
  unset in production.
  **The `freelygiv.ing` registration must be kept alive** even though the site moved off it:
  `files.books.freelygiv.ing` is a subdomain of it and serves the R2 downloads for 23 of 24
  books, plus `add-book.js`'s hardcoded `R2_BASE`. It can't move to `files.books.freely.giving`
  because R2 custom domains need the zone on Cloudflare DNS and `freely.giving` is on NS1.
  Decided 2026-08-31: keep the old domain rather than migrate.
- **Canonical URLs.** `src/layouts/Base.astro` builds `<link rel="canonical">` and `og:url`
  with a **trailing slash**, because `@astrojs/sitemap` emits `/about/` and the two must agree.
  Internal links to dynamic routes should keep the trailing slash for the same reason.
- **Base layout props** cover the whole SEO surface: `title`, `ogTitle`, `ogDescription`,
  `ogImage`, `ogImageAlt`, `ogType`. New pages should pass at least a title and description.
- **Styling** is Bootstrap 5 vendored into `public/css` + `public/js` (no build step, no npm
  Bootstrap dep). Dark mode via `data-bs-theme` on `<html>`, persisted in `localStorage` by
  `public/js/themeToggle.js` with an inline no-flash script in `Base.astro`.
- **Descriptions** in YAML are rendered by `linkify` + `newlineToBr` in `src/lib/data.js`.
  That helper treats `|` literal blocks (paragraphs split on blank lines) and `>` folded
  scalars (split on single newlines) differently — check which one a YAML file uses before
  editing prose.

## Working in this repo

- **Commit straight to `main`.** Don't create a branch for routine work — adding a book,
  a person, a fix. The owner found the branch-then-merge dance more friction than it was
  worth. Still ask before `git push`; the owner says when it goes out.
- Tell the user when a change requires restarting the Astro dev server — new covers and
  photos only appear after `sync-assets` reruns, which happens at dev/build startup.
- `sitemapActivity.md` and `_downloads/` are intentionally untracked working files; don't let
  `git add -A` sweep them in.
