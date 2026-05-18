# books-site

Personal book library site built with Astro 6. Reads book and author data from the sibling `books-data/` repo.

## Structure

```
books/          ← this repo (site code)
books-data/     ← sibling repo (YAML data + book files)
```

## Dev

```bash
npm install
npm run dev       # syncs assets from books-data, then starts dev server
```

## Adding a book

```bash
cd ../books-data
node add-book.js
```

## Build

```bash
npm run build     # output → dist/
```

## Deploy

Cloudflare Pages — set `SITE_URL` environment variable to the production domain.
