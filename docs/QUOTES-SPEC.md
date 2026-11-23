# Quote Cards — Spec (draft, 2026-11-22)

Goal: hundreds of shareable quote images (like the Flavel "heavy under adversity" card)
drawn from the books on books.freely.giving, and a place on the site where people can
find, download and share them, each one leading back to the free book.

## 1. Where they live

**On books.freely.giving, under `/quotes/`.** Not a separate site: every card's job is to
send people to a free book, and the book is one click away here. No new Worker or domain.

| URL | What it is |
|---|---|
| `/quotes/` | Gallery: grid of cards, filters, search, quote of the day (see 1a) |
| `/quotes/<id>/` | One quote: the image, the text (selectable/copyable), download buttons, share, "Read it in the book" |
| `/quotes/topics/<topic>/` | Topic pages (affliction, prayer, sin, assurance, heart, death, …) |
| Book page | New "Quotes from this book" strip (3–6 cards, link to all) |
| Person page | Same strip for the author |

The quote page's `og:image` is the card itself, so a pasted link previews as the card.

## 1a. Finding cards once there are hundreds

Who comes and what they want:
- **"I need something for a friend who's grieving."** Browses by topic.
- **"Got any Spurgeon?"** Browses by author.
- **"There was a line about affliction being a pill…"** Searches for words.
- **"Something to post today."** Wants a few good ones without a lot of choosing.

**Filters on `/quotes/`** (all can be combined, like /library's):
- **Topic**: a fixed list of ~30 in `data/src/quotes/topics.yaml` (label + one-line
  description), e.g. affliction, grief & death, assurance, prayer, the heart, sin & temptation,
  pride & humility, providence, riches & prosperity, fear, Christ, the cross, Scripture,
  the church, family, work, the Lord's Day. A quote has 1–3. An unknown topic fails the build,
  so the list stays tidy instead of growing to 200 near-duplicates.
- **Author**, with counts ("John Flavel 24"), most-quoted first.
- **Book**, narrowed to the chosen author's books when an author is picked.
- **Era**: Reformation, Puritan, 18th–19th century, modern. Taken from the author, not
  entered per quote.
- **Length**: short (≤ 20 words) or any. Short ones are what people text to a friend.

**Search box**: matches quote text, author, book and topic names as you type. At ~500
quotes the whole index is a ~150 KB JSON file loaded with the page, so it's instant and
needs no search service. Pagefind if it ever passes a few thousand.

**Behaviour:**
- Filters, search and sort live in the URL (`/quotes/?topic=grief&author=john-flavel`), so
  a filtered view is a link you can send, as with `/library/?lang=es`.
- Each filter option shows its count, and options with no matches in the current view
  are greyed, so you never land on an empty page.
- Sort: **Shuffle** (default: a fresh mix each visit, so the same 20 Flavel cards aren't
  always on top), Newest, By author.
- Grid of small WebP thumbnails, 48 at a time with "Show more". Clicking one opens the quote
  page. Alt text is the quote and author, so screen readers and Google see the words.
- On phones the filters fold into one "Filter" button opening a panel; the search box
  stays at the top.
- **Quote of the day** at the top of `/quotes/` (and optionally on the home page): picked by
  date from `featured` quotes, the same for everyone that day.

**Quote page** extras, so one card leads to the next:
"More on *affliction*", "More from *Keeping the Heart*", "More from John Flavel", and
previous/next within the topic.

**Topic pages** (`/quotes/topics/grief/`) are real pages with a short intro, so search
engines find "Puritan quotes on grief". Each is the gallery already filtered to that topic,
with a link back to the full gallery.

## 2. Data (built 2026-11-22)

One file per book, beside `book.yaml`: `data/src/books/<slug>/quotes.yaml`, a plain list.

```yaml
- id: flavel-greatest-difficulty-in-conversion-to   # author surname + first words; stable; URL and filename
  text: The greatest difficulty in conversion, is to win the heart to God; ...   # verbatim from our edition
  author: john-flavel            # person slug (person.yaml), so the author page and filter work
  book: keeping-the-heart        # book slug
  chapter: Introduction          # nearest heading in Read Online
  anchor: introduction           # id in the Read Online HTML: "Read it in the book" links to #anchor
  topics: [heart, conversion]    # 1-3, from data/src/quotes/topics.yaml; the first picks the painting
  scripture: ['Proverbs 4:23']   # verses the quote quotes, cites or plainly rests on; one verse each
  words: 24                      # for the "short" filter
  status: candidate              # candidate | approved | rejected
  featured: false                # eligible for quote of the day
  background: null               # painting file, set when approved (review page picks one)
  added: '2026-11-22'            # for "Newest" sort
```

Derived at build time, not stored per quote: author's display name (person.yaml), book title,
**era** (`data/src/quotes/eras.yaml`: person slug -> reformation | puritan | evangelical | modern),
and topic labels.

`data/src/quotes/topics.yaml`: 37 topics, each with `label`, `about` (topic-page intro) and
`mood` (which set of paintings). Scripture references are checked against the site's own BSB
(`public/bible/bible-tooltips-verses.json`), so a typo'd verse fails, and they can use the
site's verse tooltips on the quote page.

`src/lib/data.js` gets `getQuotes()` (approved only, hidden books excluded), joined to the
book and author, like the existing entry points.

## 3. Finding the quotes (built 2026-11-22)

Scripts in `scripts/quotes/` (Python needs PyYAML; working files go to `tmp/quotes/<slug>/`):

1. `python scripts/quotes/extract.py <slug>`: reads the book's Read Online HTML
   (`content/<slug>.html`) into paragraphs with anchor, chapter and the Bible references in
   each, plus `sentences.tsv` (8-45 word sentences that can stand alone).
2. **Propose**: Claude filters those to a shortlist, reads it, and writes
   `tmp/quotes/<slug>/picks.yaml`: rows of `[paragraph, starts with, ends with, topics, scripture]`.
3. `python scripts/quotes/add-candidates.py <slug>`: cuts each quote out of its paragraph
   between those two fragments (so the wording is always exactly as printed) and adds it to
   `quotes.yaml` as `candidate`. Existing quotes keep their status; rejected ones stay so they
   are never proposed again.
4. `python scripts/quotes/verify.py`: checks every quote is word-for-word in the book, the
   anchor exists, 1-3 known topics, every verse is real, the author has an era, ids unique.
5. **Review**: `node scripts/quotes/review.mjs`, then http://localhost:4330 (also
   `quote-review` in C:/code/.claude/launch.json). One card at a time with the real card
   preview, the paragraph it came from, topic chips and a Scripture box. Keys: A approve,
   R reject, U undo, F feature, arrows to move. Each click saves into `quotes.yaml`, changing
   only that quote's lines. Approving assigns the painting.
6. **Render** approved quotes (section 4).

First batch, 2026-11-22: 117 candidates from *Keeping the Heart* (39), *Precious Remedies*
(45) and *The Mortification of Sin* (33). All pass verify.py.

## 4. The cards

**Look:** dark, softened public-domain painting behind; quote in white Crimson Pro, centred;
author's name in gold below it. The `BOOKS.FREELY.GIVING` tag sits in the **same fixed spot
on every card, lower left**, in the back-cover face (Medium Rare Ribeye,
`C:/code/Psalm119Devotional/cover/assets/medium-rare-ribeye.ttf`), gold, spaced caps as on
the book backs. Nothing above the quote. Our own label and type, not a copy of the
"Puritan Gold" account's.

**Size:** 1080×1080 square only (decided 2026-11-22). The quote page's `og:image` uses the
same square image.

**Backgrounds:** a curated set of ~40 public-domain paintings (Art Institute of Chicago CC0,
Met Open Access, Rijksmuseum, National Gallery of Art), darkened and blurred slightly, each
tagged by mood (storm, sea, field, night, mountain, interior). Assigned by topic, varied so
no two cards from one book share one. Credits listed on `/quotes/` ("Backgrounds:").

**Text fitting:** font size steps down with length; max ~45 words keeps it readable on a
phone. Hanging punctuation, real curly quotes and apostrophes, no orphan last word.

**Renderer:** the card template is `scripts/quotes/card.mjs` (shared with the review page, so
the preview is the real card). Rendering (to build) will screenshot it at 1080×1080 in
headless Chrome via puppeteer-core, with the fonts bundled in `scripts/quotes/fonts/`
(Medium Rare Ribeye + Crimson Pro, both OFL), so output doesn't depend on installed fonts.
Signature-based skip like `build-og.js`, so only changed cards re-render.

**Storage:** JPEGs (~150–250 KB each; ~500 quotes ≈ 100 MB) go to **R2**
(`files.books.freelygiv.ing/quotes/<id>.jpg`), not git. Small WebP thumbnails
for the gallery grid also on R2. Upload via the existing `upload-to-r2.js` pattern.

## 5. Sharing and downloading

- **Download** button (`download` attribute; R2 serves `Content-Disposition`).
- **Share** button: on phones, Web Share API with the image file + link (straight into
  Instagram/WhatsApp/Messages); on desktop, copy link / Facebook / X / email.
- **Copy text** button: quote + "— John Flavel, *Keeping the Heart*" + link.
- "Download all from this book" zip: later, if asked for.
- Counting: the quote pages show up in the stats archive already; downloads counted from
  R2/zone analytics on `files.books.freelygiv.ing`.

## 4a. Backgrounds (downloaded 2026-11-22)

40 paintings from the Art Institute of Chicago (all CC0), 1686 px wide, in `quote-art/`
(gitignored; 36 MB). Named by mood: storm-01…09, sky-01…10, forest-01…09, mountain-01…07,
ruins-01…02, winter-01…02, road-01. `quote-art/credits.json` has title, artist, date,
museum page and licence for each, for the credits line on `/quotes/`. `contact-sheet.jpg`
shows them all. Candidate search results are kept in `quote-art/_candidates/`.

## 4b. Light cards (2026-11-22)

Some cards are light: a bright sky painting washed pale, dark ink, deeper gold (`.card.light`
in `card.mjs`). Ten bright paintings, `quote-art/light-01…10.jpg` (Monet, Sisley, Inness,
Courbet, Kensett, Guigou; AIC, CC0), credited in `credits.json` with mood `light`. A card is light
when its painting is a `light-` one. Hopeful topics (heaven, peace, mercy, grace, assurance,
faith, Christ) have mood `light` in topics.yaml, so quotes with one of those first go light
automatically (16 of the first 117). **L** on the review page flips any card light/dark.
No photos for now: paintings only (Michael, 2026-11-22).

## 5a. Sample cards (2026-11-22)

`tmp/quote-samples/` (not committed) has six Flavel cards in three looks. A is a painting
with light blur. B is a painting with more blur and the author's name in Ribeye. C uses the
book's own colour with a gold frame and no painting. They were rendered with headless Chrome
(puppeteer-core) from an HTML template, which handles the fonts and fits the text; that may
replace satori in section 4.

## 6. Build order

1. Card design: render 6 sample cards from *Keeping the Heart* in 2–3 looks; pick one.
2. `quotes.yaml` format + extract/verify scripts; run on 3 books (Flavel, Brooks, Owen).
3. Review page; Michael approves the first batch.
4. `/quotes/` gallery + quote page + book-page strip, with that first batch (~30).
5. Push live; then work through the remaining books in batches of ~10.

## 0. Built (2026-11-22)

- **Every quote not marked `rejected` is public** (Michael: publish them all; remove any later
  by setting `status: rejected`). The phone review page is optional.
- `/quotes/` (menu: "Memes/Images"): quote of the day, search, topic/author/book/era filters,
  "short ones only", Mixed/Dark/Light background switch, shuffled/newest/by-author order, all in
  the URL. `src/components/QuoteGallery.astro`, `src/pages/quotes/index.astro`.
- `/quotes/<id>/`: the card with a Dark/Light switch (`?bg=light` in shared links), Download,
  Share (sends the image itself on phones where it can), Copy quote, Facebook/X/WhatsApp/
  Pinterest/Email/Copy link, Read it in the book, Scripture, topics, more like this.
- `/quotes/topics/<topic>/`: the gallery opened on one topic.
- Data: `getQuotes()`, `getQuoteTopics()`, `quoteImage()` in `src/lib/data.js`.
- Images: `node scripts/quotes/render-cards.mjs` -> `public/static/quotes/` (dev), then
  `node scripts/quotes/upload-cards.mjs` -> R2 `quotes/` (the built site points there).
  **Upload before pushing**, or the live page shows broken images.
- R2 CORS rule "quote-cards" (added 2026-11-22) lets books.freely.giving and the pages.dev host
  fetch the images, so Download saves the file and Share can send the picture itself.

- **Three looks per quote** (2026-11-23): painting dark, painting light, and solid colour (framed
  like the prepared-book covers; six colours in `SOLIDS`, scripts/quotes/card.mjs). Colour stored
  as `background.solid`; `tone` (dark | light | solid) is the look shown first. Gallery switch:
  Mixed / Dark / Light / Solid. Author line in Crimson Pro bold (2026-11-22). Quote pages swipe.

## 7. Decided (2026-11-22)

- Tag: `BOOKS.FREELY.GIVING` in the back-cover Ribeye face, fixed lower left on every card.
- All authors from the start, modern ones included (everything is CC0 / public domain).
- Wording verbatim as printed in our edition; no modernising.
- One size: 1080×1080 square.
- **Both looks for every quote** (decided 2026-11-22): each approved quote is rendered light and
  dark; its page on BFG has a Light/Dark switch, and `tone` says which shows first.
  `background: {dark, light}` holds the painting for each.
- **Review on the phone** (2026-11-22): private claude.ai page
  https://claude.ai/artifact/YaxZqYdHPRLRjssPvFQVKa (only Michael can open it). It shows each
  candidate's card (both looks, from `scripts/quotes/render-previews.mjs`), the paragraph it came
  from, topic chips, Scripture, Approve/Reject, light/dark and quote-of-the-day. Its database holds
  one document per quote. To bring decisions home: ArtifactData `list` of collection `quotes` with
  out_dir `tmp/quotes/phone-review/pulled`, then `python scripts/quotes/pull-review.py` and
  `python scripts/quotes/verify.py`. New candidates: re-run render-previews, republish the page with
  the new card images, and add their documents (seed files in `tmp/quotes/phone-review/seed/`).
  The PC page (`review.mjs`) still works for the same files.
- Look **B** chosen: painting at brightness 0.5, blur 4px, saturation 0.8, soft dark vignette;
  quote white Crimson Pro; author's name gold Ribeye; book title cream italic Crimson Pro under it;
  tag lower left. Template: `tmp/quote-samples/render.cjs` (look B branch).

## 8. Later, maybe

- **Author-photo backgrounds** (Michael, 2026-11-23): a card that uses the author's portrait
  (person photos on BFG, e.g. the Flavel engraving, Spurgeon) faded to one side, quote beside it;
  likely a fourth look.

- "Quote of the day" on the home page, or an RSS feed of it.

## Bible verse cards (2026-11-23)

`data/src/quotes/scripture.yaml` holds verse cards, all from the BSB (the modified master,
synced to `public/bible/`). Fields: `id` (e.g. `psalm-147-3`), `ref` (one verse or a range in
one chapter, "Psalm 147:3-4"), `text` (verify.py checks it is the BSB word for word),
`topics`, `status`, `added`; render-cards adds `background` and `tone` as for book quotes
(set `tone: light` by hand when the verse is hopeful and the topic's mood is dark).
The card shows the reference in the author's place and "Berean Standard Bible" in the
book's. On the site they are "Bible (BSB)" in the Authors filter and "Berean Standard Bible"
in the Books filter; the quote page links to /library/ instead of a book page.
Verse cards carry a second site name, CONFESS.CATECHIZE.ING, bottom right (stacked under
BOOKS.FREELY.GIVING on framed cards); that markup and CSS live in render-cards.mjs (TAG2), not
card.mjs, so the book cards don't re-render. A card may quote part of the verse(s): psalm
superscriptions and unpaired quotation marks are left off, and the master's plural "you+" is
shown as plain "you" unless Michael asks to keep it for a card (2026-11-23: 43 verses, none kept).
