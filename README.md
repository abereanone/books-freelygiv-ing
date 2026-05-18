# books.freely.giving

Website for [books.freely.giving](https://books.freely.giving) — a library of freely given books.

## Development

```bash
cd src
npm install
npm run dev
```

The site will be served at `http://localhost:8080`.

## Structure

- `src/` — Eleventy project
  - `pages/` — templates and data
  - `static/` — CSS, JS, images, and book files
  - `library/` — git submodule ([freely-given-books-data](https://github.com/freely-given-books/freely-given-books-data))

## Building

```bash
cd src
npm run build
```

Output is written to `src/_site/`.

## Deployment

Pushing a git tag triggers the GitHub Actions workflow, which builds the site and publishes a tarball to the GitHub release.

Set the `SITE_URL` repository variable in GitHub (Settings → Secrets and variables → Actions → Variables) to control the site URL used in the build.
