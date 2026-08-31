# Sitemap Activity

Working notes for this repo, part of a sitemap + Google Search Console rollout across all of
the owner's sites. **The master checklist lives at `c:\code\sitemaptasks.md`** — this file
covers only this repo.

> This file is intentionally **untracked**. It's working notes, not part of the site. Watch out
> for `git add -A` sweeping it into a commit; add it deliberately if you decide you want it in
> the repo.

_Last updated 2026-08-18._

## This repo

**Site:** https://books.freely.giving · Astro, `output: static`, Cloudflare Pages.

Note the repo folder name says `freelygiv-ing`, but **the site's main domain is
`books.freely.giving`**. Both were live; see below.

## Status: done, awaiting push

Branch **`add-sitemap`**, 2 commits:
- `b32bd67` — Generate a sitemap at build time
- `951d777` — Point the sitemap at books.freely.giving

### What changed
- Added `@astrojs/sitemap` and `public/robots.txt`. **48 URLs** (23 books, 17 authors,
  3 contributors, indexes).
- `site` still honours `process.env.SITE_URL`, falling back to `https://books.freely.giving`,
  so a preview deploy builds a preview-scoped sitemap rather than claiming production.

### Duplicate domain — already fixed, live now
The site answered **200 on both** `books.freely.giving` and `books.freelygiv.ing`, same content,
neither redirecting. There is now a **301** from the old host, preserving path and query string:

- Cloudflare zone `freelygiv.ing` (`7b604597046f8fea8e58a20aa334644c`, account `abereanone@pm.me`)
  → Redirect Rules → ruleset `default` → *"Redirect books.freelygiv.ing to books.freely.giving"*.
- Placed **first**, ahead of the pre-existing HTTP→HTTPS template rule, so `http://` on the old
  host reaches the canonical host in one hop instead of two.
- Verified after a cache purge: 40/40 requests 301, single hop, landing on 200.

`files.books.freelygiv.ing` is the **R2 asset host** — a different hostname, unaffected by the
rule. `add-book.js` still references it, deliberately.

## What the owner does next
1. **Before pushing:** check the Cloudflare Pages project's environment variables. If `SITE_URL`
   is set there it overrides the domain and the sitemap will be built from it. If unset, fine.
2. Merge, push.
3. Verify `https://books.freely.giving/sitemap-index.xml` → 200, **48** URLs, and that every
   `<loc>` says `books.freely.giving` (none should say `freelygiv.ing`).
4. Submit `sitemap-index.xml` under the **`freely.giving`** domain property.

⚠️ **`freely.giving` is on NS1 nameservers, not Cloudflare** — it's the one domain in the whole
project whose Search Console TXT record is added somewhere other than Cloudflare.

Decided: **no** Search Console property for `freelygiv.ing`, since it now just redirects.

## Remaining work here
None. Refreshes on every build.

---

## Project-wide conventions (apply here too)

- **Never push.** Changes are committed on a branch; the owner reviews and pushes.
- Search Console uses **domain properties** (11 total across all sites), verified by DNS TXT.
- Every site gets a `robots.txt` with a `Sitemap:` line. Confirmed that a repo `public/robots.txt`
  surfaces live even though Cloudflare serves a managed Content Signals robots.txt on these zones.
- Cloudflare Pages serves the root `index.html` **with a 200** for unmatched paths when a project
  has no `404.html`. Several sites had this soft-404 problem; the fix is simply adding `404.html`.
