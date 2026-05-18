# books-site

Personal book library site built with Astro 6.

## Structure

```
data/src/          ← book and author YAML + content files
src/               ← Astro pages, components, layouts
public/            ← static CSS, JS, images
scripts/           ← asset sync script
add-book.js        ← interactive CLI for adding books
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

## Build

```bash
npm run build      # output → dist/
```

## Deploy

Cloudflare Pages — set `SITE_URL` environment variable to `https://books.freelygiv.ing`.
