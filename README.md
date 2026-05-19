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

Cloudflare Pages - set `SITE_URL` environment variable to `https://books.freelygiv.ing`.
