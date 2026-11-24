# Sync report for Courtney Hicks

This file is for Courtney Hicks and his tools. https://books.freely.giving rewrites it each time it syncs a
Freely Given Books release from https://github.com/freely-given-books/books. Read it after
publishing a release to see what the site took, and anything to fix in the next release.
Nothing in it needs a change on the site's side: fix things in the release and publish a new
one, and the next sync picks it up.

- Last sync: 2026-11-24
- Release: 2026.11.22.2
- Editions in the release: 41; on the site: 20; hidden: 21; not imported or not updated: 0

## Editions

| Edition | Version | Status | Page |
| --- | --- | --- | --- |
| the-1689-baptist-confession-of-faith | v2 | on the site | https://books.freely.giving/books/courtney-hicks/the-1689-baptist-confession-of-faith/ |
| the-anatomy-of-simon-magus | v7 | on the site | https://books.freely.giving/books/anonymous/the-anatomy-of-simon-magus/ |
| all-of-grace | v17 | on the site | https://books.freely.giving/books/charles-spurgeon/all-of-grace/ |
| all-of-grace-modern | v2 | imported, hidden until the site owner finishes it |  |
| grace-abounding | v3 | on the site | https://books.freely.giving/books/john-bunyan/grace-abounding/ |
| grace-abounding-modern | v2 | imported, hidden until the site owner finishes it |  |
| the-pilgrims-progress | v16 | on the site | https://books.freely.giving/books/john-bunyan/the-pilgrims-progress/ |
| the-pilgrims-progress-modern | v1 | imported, hidden until the site owner finishes it |  |
| indwelling-sin | v3 | on the site | https://books.freely.giving/books/john-owen/indwelling-sin/ |
| indwelling-sin-modern | v1 | imported, hidden until the site owner finishes it |  |
| of-temptation | v3 | on the site | https://books.freely.giving/books/john-owen/of-temptation/ |
| of-temptation-modern | v1 | imported, hidden until the site owner finishes it |  |
| the-death-of-death | v2 | on the site | https://books.freely.giving/books/john-owen/the-death-of-death/ |
| the-mortification-of-sin | v4 | on the site | https://books.freely.giving/books/john-owen/the-mortification-of-sin/ |
| the-mortification-of-sin-modern | v1 | imported, hidden until the site owner finishes it |  |
| religious-affections | v1 | imported, hidden until the site owner finishes it |  |
| religious-affections-modern | v1 | imported, hidden until the site owner finishes it |  |
| sinners-in-the-hands-of-an-angry-god | v10 | on the site | https://books.freely.giving/books/jonathan-edwards/sinners-in-the-hands-of-an-angry-god/ |
| sinners-in-the-hands-of-an-angry-god-modern | v2 | imported, hidden until the site owner finishes it |  |
| the-glorious-feast-of-the-gospel | v16 | on the site | https://books.freely.giving/books/richard-sibbes/the-glorious-feast-of-the-gospel/ |
| the-glorious-feast-of-the-gospel-modern | v1 | imported, hidden until the site owner finishes it |  |
| the-crook-in-the-lot | v2 | on the site | https://books.freely.giving/books/thomas-boston/the-crook-in-the-lot/ |
| the-crook-in-the-lot-modern | v1 | imported, hidden until the site owner finishes it |  |
| precious-remedies-against-satans-devices | v3 | on the site | https://books.freely.giving/books/thomas-brooks/precious-remedies-against-satans-devices/ |
| precious-remedies-against-satans-devices-modern | v1 | imported, hidden until the site owner finishes it |  |
| the-secret-key-of-heaven | v9 | on the site | https://books.freely.giving/books/thomas-brooks/the-secret-key-of-heaven/ |
| the-secret-key-of-heaven-modern | v1 | imported, hidden until the site owner finishes it |  |
| the-surest-way-of-thriving | v2 | imported, hidden until the site owner finishes it |  |
| the-surest-way-of-thriving-modern | v2 | imported, hidden until the site owner finishes it |  |
| a-divine-cordial | v3 | on the site | https://books.freely.giving/books/thomas-watson/a-divine-cordial/ |
| a-divine-cordial-modern | v2 | imported, hidden until the site owner finishes it |  |
| domestical-duties-volume-1 | v4 | on the site | https://books.freely.giving/books/william-gouge/domestical-duties-volume-1/ |
| domestical-duties-volume-2 | v4 | on the site | https://books.freely.giving/books/william-gouge/domestical-duties-volume-2/ |
| domestical-duties-volume-3 | v4 | on the site | https://books.freely.giving/books/william-gouge/domestical-duties-volume-3/ |
| domestical-duties-volume-4 | v4 | on the site | https://books.freely.giving/books/william-gouge/domestical-duties-volume-4/ |
| domestical-duties-modern-volume-1 | v1 | imported, hidden until the site owner finishes it |  |
| domestical-duties-modern-volume-2 | v1 | imported, hidden until the site owner finishes it |  |
| domestical-duties-modern-volume-3 | v1 | imported, hidden until the site owner finishes it |  |
| domestical-duties-modern-volume-4 | v1 | imported, hidden until the site owner finishes it |  |
| christian-economy | v5 | on the site | https://books.freely.giving/books/william-perkins/christian-economy/ |
| christian-economy-modern | v1 | imported, hidden until the site owner finishes it |  |

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
