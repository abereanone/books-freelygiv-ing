# Quote cards: adding the other books (started 2026-11-23)

Michael asked for quotes from all the other books. Pipeline and rules: `docs/QUOTES-SPEC.md`
section 3. Per book: `python scripts/quotes/extract.py <slug>`, shortlist, read it, write
`tmp/quotes/<slug>/picks.yaml` (8-15 picks: `[paragraph, starts with, ends with, topics, scripture]`),
`python scripts/quotes/add-candidates.py <slug>`, `python scripts/quotes/verify.py`.
Every author needs a line in `data/src/quotes/eras.yaml`. Mark a book `done` here when it
passes verify, then commit (local only).

After each batch: `node scripts/quotes/render-cards.mjs`, build; **uploading to R2 and pushing
need Michael's OK** (never done by the hourly task).

Skipped: Spanish translations (same quotes as the English); confession (1689); hidden books.

## Batch 1: English books with Read Online HTML in the repo
- [x] a-divine-cordial (Watson)
- [x] a-token-for-mourners (Flavel)
- [x] all-of-grace (Spurgeon)
- [x] autobiography-of-charles-spurgeon (I)
- [x] autobiography-of-charles-spurgeon-vol-2
- [x] autobiography-of-charles-spurgeon-vol-3
- [x] autobiography-of-charles-spurgeon-vol-4
- [x] catechism-of-suffering (Statler)
- [x] christian-economy (Perkins)
- [x] doctrine-of-law-and-grace (Bunyan)
- [x] domestical-duties-volume-1 (Gouge)
- [x] domestical-duties-volume-2
- [x] domestical-duties-volume-3
- [x] domestical-duties-volume-4
- [x] grace-abounding (Bunyan)
- [x] indwelling-sin (Owen)
- [x] meditations-on-psalm-119 (Coughlin)
- [x] morning-and-evening (Spurgeon)
- [x] of-temptation (Owen)
- [x] on-the-election-of-infants (Coughlin)
- [x] our-sin-his-mercy (Conkle)
- [x] sinners-in-the-hands-of-an-angry-god (Edwards)
- [x] the-anatomy-of-simon-magus (anonymous): 1 (picked by Michael, 2026-11-23)
- [x] the-crook-in-the-lot (Boston)
- [x] the-death-of-death (Owen)
- [x] the-glorious-feast-of-the-gospel (Sibbes)
- [x] the-godly-mans-picture (Watson)
- [x] the-pilgrims-progress (Bunyan)
- [x] the-secret-key-of-heaven (Brooks)

Batch 1 done 2026-11-23 (383 quotes, 31 books); render, upload and push wait for Michael's OK.

## Batch 2: EPUB / PDF only (extract.py reads EPUB and PDF since 2026-11-23; PDF quotes record the page)
- [x] the-divine-name (Case, EPUB)
- [x] expositions-on-the-psalms (Augustine, PDF)
- [x] institutes-of-the-christian-religion-part-1 / part-2 (Calvin, PDF)
- [x] owen-on-sin (Owen, PDF)
- [x] these-five-anchors (Maragni, PDF)
- [x] our-sin-his-mercy-childrens-devotions (Conkle, PDF)

Batch 2 done 2026-11-23 (49 quotes, 7 books; 432 in all); render, upload and push wait for Michael's OK.

## Batch 3: text only on other sites (Michael's OK 2026-11-23)
Files came from our R2 host, sellingjesus.org (God's Word Is Not Bound) and simony.info. Multi-author
books credit each quote to the chapter's writer (6th field in picks.yaml): bylines in God's Word Is Not
Bound; for Abolish the Jesus Trade, the author of the matching sellingjesus.org article.
- [x] abolish-the-jesus-trade (Case, Owens): 5
- [x] gods-word-is-not-bound (Case, Coughlin, Owens, Here): 8
- [x] the-dorean-principle (Owens): 5
- [x] the-doctrine-of-simony (Owens): 6
- [x] god-spoke (Mangum): 4
- [x] jude-a-theological-commentary (Pritchard): 4
- [x] luthers-works-the-freely-given-edition-volume-1519-part-1 (Luther, PDF): 4
- [x] praying-the-bible-together (Case, PDF; the EPUB has no text): 2, Case's own prayers only
- [x] surprised-by-hesed (Feezell): 4
- [x] the-mark-of-a-true-disciple (Pritchard): 6
- [x] cristina-of-aspen-aisle (Case, MOBI turned to tmp/quotes/<slug>/source.html): 1
- [ ] poured-forth (Feezell): skipped, Amazon only

Batch 3 done 2026-11-23 (49 quotes, 11 books; 491 in 50 books).
