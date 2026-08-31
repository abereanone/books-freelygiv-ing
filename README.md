# books-site

Personal book library site built with Astro 6.

## Structure

```
data/src/<person>/    <- author/contributor YAML + person images
data/src/books/       <- book YAML + content files
src/                  <- Astro pages, components, layouts
public/               <- static CSS, JS, images
scripts/              <- asset sync and upload scripts
add-book.js           <- interactive CLI for adding books
```

## Dev

```bash
npm install
npm run dev
```

## Adding a book

```bash
node add-book.js
```

See [docs/BOOK-FILES.md](docs/BOOK-FILES.md) for how to add or replace the
downloadable files (PDF, EPUB, print-ready ZIP), which are served from R2
rather than committed to git.

Book records store author slugs, including multiple authors when needed:

```yaml
authors:
  - author-one
  - author-two
```

## Build

```bash
npm run build      # output -> dist/
```

## Deploy

Cloudflare Pages. The canonical domain is `https://books.freely.giving`, which is the
default `site` in `astro.config.mjs` - leave `SITE_URL` **unset** in production.
`SITE_URL` exists so a preview deploy can build against its own origin, and it also
determines the sitemap's `<loc>` entries, so setting it in production would point the
sitemap at the wrong host.

`books.freelygiv.ing` 301s to the canonical domain. **Do not let the `freelygiv.ing`
registration lapse** — `files.books.freelygiv.ing` is a subdomain of it and serves every
book download from R2. See [docs/BOOK-FILES.md](docs/BOOK-FILES.md).
