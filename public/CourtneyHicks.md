# Sync report for Courtney Hicks

This file is for Courtney Hicks and his tools. https://books.freely.giving rewrites it each time it syncs a
Freely Given Books release from https://github.com/freely-given-books/books. Read it after
publishing a release to see what the site took, and anything to fix in the next release.
Nothing in it needs a change on the site's side: fix things in the release and publish a new
one, and the next sync picks it up.

- Last sync: 2026-11-18
- Release: 2026.11.10
- Editions in the release: 21; on the site: 21; hidden: 0; not imported or not updated: 0

## Editions

| Edition | Version | Status | Page |
| --- | --- | --- | --- |
| the-1689-baptist-confession-of-faith | v1 | on the site | https://books.freely.giving/books/courtney-hicks/the-1689-baptist-confession-of-faith/ |
| the-anatomy-of-simon-magus | v7 | on the site | https://books.freely.giving/books/anonymous/the-anatomy-of-simon-magus/ |
| all-of-grace | v16 | on the site | https://books.freely.giving/books/charles-spurgeon/all-of-grace/ |
| grace-abounding | v2 | on the site | https://books.freely.giving/books/john-bunyan/grace-abounding/ |
| the-pilgrims-progress | v14 | on the site | https://books.freely.giving/books/john-bunyan/the-pilgrims-progress/ |
| indwelling-sin | v1 | on the site | https://books.freely.giving/books/john-owen/indwelling-sin/ |
| of-temptation | v2 | on the site | https://books.freely.giving/books/john-owen/of-temptation/ |
| owen-on-sin | v1 | on the site | https://books.freely.giving/books/john-owen/owen-on-sin/ |
| the-death-of-death | v1 | on the site | https://books.freely.giving/books/john-owen/the-death-of-death/ |
| the-mortification-of-sin | v2 | on the site | https://books.freely.giving/books/john-owen/the-mortification-of-sin/ |
| sinners-in-the-hands-of-an-angry-god | v9 | on the site | https://books.freely.giving/books/jonathan-edwards/sinners-in-the-hands-of-an-angry-god/ |
| the-glorious-feast-of-the-gospel | v14 | on the site | https://books.freely.giving/books/richard-sibbes/the-glorious-feast-of-the-gospel/ |
| the-crook-in-the-lot | v1 | on the site | https://books.freely.giving/books/thomas-boston/the-crook-in-the-lot/ |
| precious-remedies-against-satans-devices | v2 | on the site | https://books.freely.giving/books/thomas-brooks/precious-remedies-against-satans-devices/ |
| the-secret-key-of-heaven | v7.1 | on the site | https://books.freely.giving/books/thomas-brooks/the-secret-key-of-heaven/ |
| a-divine-cordial | v2 | on the site | https://books.freely.giving/books/thomas-watson/a-divine-cordial/ |
| domestical-duties-volume-1 | v2 | on the site | https://books.freely.giving/books/william-gouge/domestical-duties-volume-1/ |
| domestical-duties-volume-2 | v2 | on the site | https://books.freely.giving/books/william-gouge/domestical-duties-volume-2/ |
| domestical-duties-volume-3 | v2 | on the site | https://books.freely.giving/books/william-gouge/domestical-duties-volume-3/ |
| domestical-duties-volume-4 | v2 | on the site | https://books.freely.giving/books/william-gouge/domestical-duties-volume-4/ |
| christian-economy | v3.2 | on the site | https://books.freely.giving/books/william-perkins/christian-economy/ |

## Not imported (fix and re-release)

None.

## Imported, but please check

None.

## What the sync needs, per edition

`slug`, `pages`, and `files` with `pdf`, `cover` (the Lulu cover PDF) and `front` (the front cover
PNG). `epub` and `reader` (Read Online) are optional: an edition without them (a combined paperback,
say) goes up with only the buttons it has. `compare` gives What's New?. Per book: `title`,
`author`. Every file named must be attached to the release and listed in `SHA256SUMS`.

## Volumes, and modern and classic wordings

The site links books that belong together and puts switch buttons on each book's page
(Volume: Vol. I | Vol. II …; Version: Classic | Modern), so a reader can move between them.

- **Volumes** work already: give each edition its `"volume"` (1, 2, …), as Of Domestical
  Duties does. The volumes of one book are linked to each other.
- **The same work in modern and classic wording** is two books in `site.json`, each with its
  own `book`, `title` and edition `slug`s (the slugs must differ, e.g. `the-secret-key-of-heaven`
  and `the-privie-key-of-heaven`). Give both books:
  - `"wording"`: `"modern"` (spelling or grammar brought up to date) or `"classic"` (the
    wording and spelling as first printed)
  - `"set"`: the same short key on both, e.g. `"secret-key-of-heaven"`
- A work in volumes in both wordings: the same `set` on both books and the same `volume`
  numbers, so Vol. II modern switches to Vol. II classic.
- One wording only for now: `wording` and `set` are still welcome; the switch appears once the
  other wording is in a release.

```json
{ "book": "thomas-brooks/the-secret-key-of-heaven", "title": "The Secret Key of Heaven",
  "wording": "modern", "set": "secret-key-of-heaven", "editions": [ { "slug": "the-secret-key-of-heaven", … } ] },
{ "book": "thomas-brooks/the-privie-key-of-heaven", "title": "The Privie Key of Heaven",
  "wording": "classic", "set": "secret-key-of-heaven", "editions": [ { "slug": "the-privie-key-of-heaven", … } ] }
```
