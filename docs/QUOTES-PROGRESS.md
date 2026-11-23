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
- [ ] catechism-of-suffering (Statler)
- [ ] christian-economy (Perkins)
- [ ] doctrine-of-law-and-grace (Bunyan)
- [ ] domestical-duties-volume-1 (Gouge)
- [ ] domestical-duties-volume-2
- [ ] domestical-duties-volume-3
- [ ] domestical-duties-volume-4
- [ ] grace-abounding (Bunyan)
- [ ] indwelling-sin (Owen)
- [ ] meditations-on-psalm-119 (Coughlin)
- [ ] morning-and-evening (Spurgeon)
- [ ] of-temptation (Owen)
- [ ] on-the-election-of-infants (Coughlin)
- [ ] our-sin-his-mercy (Conkle)
- [ ] sinners-in-the-hands-of-an-angry-god (Edwards)
- [ ] the-anatomy-of-simon-magus (anonymous)
- [ ] the-crook-in-the-lot (Boston)
- [ ] the-death-of-death (Owen)
- [ ] the-glorious-feast-of-the-gospel (Sibbes)
- [ ] the-godly-mans-picture (Watson)
- [ ] the-pilgrims-progress (Bunyan)
- [ ] the-secret-key-of-heaven (Brooks)

## Batch 2: EPUB / PDF only (extract.py needs EPUB/PDF support first)
- [ ] the-divine-name (Case, EPUB)
- [ ] expositions-on-the-psalms (Augustine, PDF)
- [ ] institutes-of-the-christian-religion-part-1 / part-2 (Calvin, PDF)
- [ ] owen-on-sin (Owen, PDF)
- [ ] these-five-anchors (Maragni, PDF)
- [ ] our-sin-his-mercy-childrens-devotions (Conkle, PDF)

## Batch 3: text only on other sites (no local file)
abolish-the-jesus-trade, cristina-of-aspen-aisle, god-spoke, gods-word-is-not-bound,
jude-a-theological-commentary, luthers-works-...-1519-part-1, poured-forth,
praying-the-bible-together, surprised-by-hesed, the-doctrine-of-simony, the-dorean-principle,
the-mark-of-a-true-disciple. Ask Michael before fetching or downloading any of these.
