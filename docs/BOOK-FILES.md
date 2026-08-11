# Adding & replacing book files (PDF, EPUB, print-ready ZIP)

This is the short version for anyone who just needs to get a file onto the site.

## The one thing to understand first

There are **two separate places**, and a file is not live until it is in both:

| What                                              | Lives in                                   | Gets there by      |
| ------------------------------------------------- | ------------------------------------------ | ------------------ |
| The **page** (title, description, download links) | `data/src/books/<slug>/book.yaml`, in git   | `git push`         |
| The **actual file** (PDF/EPUB/ZIP)                | Cloudflare R2, served from `files.books.freelygiv.ing` | `npm run upload`   |

Big files are **not** stored in git — `.gitignore` excludes `*.pdf`, `*.zip`, `*.epub`, `*.mobi`. Your local copy in `content/` is just the staging area for the upload. Cover images are the exception: those *are* committed and are copied into `public/` automatically.

## Naming

**The one hard rule:** the upload script uses the filename verbatim as the R2 key, so the filename in `content/` and the URL in `book.yaml` must match exactly — including capitalisation. Everything else is preference.

The default convention, used by most books:

```
data/src/books/<book-slug>/content/
    cover.jpg                 <- or .png, committed to git
    <book-slug>.pdf           <- e.g. the-pilgrims-progress.pdf
    <book-slug>.epub
    <book-slug>.mobi
    print-ready.zip           <- literally "print-ready.zip"
```

giving URLs like `https://files.books.freelygiv.ing/<book-slug>/<book-slug>.pdf`.

Some books keep the publisher's original filenames instead — `our-sin-his-mercy` uses `OurSinHisMercy.pdf` and `OurSinHisMercy.zip`. That's fine. Pick one and make `book.yaml` agree with it.

**If you change a filename on a book that is already live**, you are creating a *new* R2 object, not renaming the old one. Upload the new name, update `book.yaml`, then delete the old object from R2 — otherwise the old file lingers and the site 404s until the YAML is pushed.

## Replace a PDF or ZIP on an existing book

The common case. Two commands:

```bash
# 1. Drop the new file in, using the name that book.yaml already points at
cp /path/to/NewFile.pdf data/src/books/our-sin-his-mercy/content/OurSinHisMercy.pdf
cp /path/to/NewPrint.zip data/src/books/our-sin-his-mercy/content/OurSinHisMercy.zip

# 2. Push it to R2, overwriting what's there
npm run upload -- our-sin-his-mercy --force
```

`--force` is required for a replacement. Without it the script sees the key already exists and skips it — you'd get "already existed" and wonder why the site still serves the old file.

No `book.yaml` edit and no site rebuild are needed: the URL didn't change, only what's behind it. Readers may see the old file for a few minutes until the CDN cache expires.

## Add a *new* file type to an existing book

E.g. the book had a PDF, now it also has a print-ready ZIP.

1. Copy the file into `content/` with the correct name (above).
2. `npm run upload -- <book-slug>` — no `--force` needed, it's a new key.
3. Add the entry to `mediaTypes` in `data/src/books/<book-slug>/book.yaml`:

```yaml
    - type: printReady
      label: Print Ready
      sources:
        - name: Download
          url: https://files.books.freelygiv.ing/<book-slug>/print-ready.zip
```

Known `type` values: `htmlBook`, `pdfBook`, `epubBook`, `printBook` (a store link, e.g. Lulu), `printReady`.

4. Commit and push `book.yaml`. Cloudflare Pages rebuilds on push.

## Add a whole new book

```bash
node add-book.js          # interactive, writes data/src/books/<slug>/book.yaml
```

Then create `data/src/books/<slug>/content/`, drop in the cover plus any PDF/EPUB/ZIP using the naming above, run `npm run upload -- <slug>`, and commit. If the author is new, they also need `data/src/<author-slug>/author.yaml` and a photo.

## Upload script reference

```bash
npm run upload                              # every book, only files not already in R2
npm run upload -- our-sin-his-mercy         # just that book
npm run upload -- our-sin-his-mercy --force # overwrite existing objects
npm run upload -- book-one book-two         # several books
```

Requires a `.env` in the project root (never committed):

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_KEY=...
R2_BUCKET=books-freelygiv-ing
```

The API token must have **Object Read & Write** on the bucket. A read-only token fails with `AccessDenied` (HTTP 403) at the upload step.

## Checklist

- [ ] Filename matches the URL in `book.yaml` exactly, capitalisation included
- [ ] Sitting in `data/src/books/<book-slug>/content/`
- [ ] `npm run upload -- <slug>` (add `--force` if replacing)
- [ ] Output says `upload` or `replace`, not `skip`
- [ ] URL opens in a browser
- [ ] `book.yaml` committed and pushed, if links changed

## When it doesn't work

**Says `skip`, site serves the old file** — you forgot `--force`.

**`AccessDenied` / 403** — the R2 token is wrong, expired, or read-only. Regenerate it in the Cloudflare dashboard under R2 → Manage API Tokens with Object Read & Write, and update `.env`.

**Download link 404s** — the filename in `content/` doesn't match the URL in `book.yaml`. Compare them character by character; it's almost always a capital letter or an underscore vs. hyphen.

**File uploaded but the page doesn't show the link** — the `mediaTypes` entry is missing from `book.yaml`, or the change wasn't pushed.

**Cover doesn't appear** — covers are synced separately by `scripts/sync-assets.js`, which runs as part of `npm run dev` and `npm run build`. Restart the dev server after adding one.
