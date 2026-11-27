# Scan check: instructions for a helper

You are checking the typed text of *Keeping the Heart* (John Flavel, American Tract Society edition)
against the scanned pages of the printed book, one page at a time. Work in the book's own folder.
You are given a batch name (b1–b4) and its page range.

Batches: b1 = scan pages 11–57, b2 = 58–104, b3 = 105–151, b4 = 152–198.

## For each page N in your range, in order

1. If `check/results/nN.tsv` already exists, skip the page (it is done).
2. Touch your claim file so others know you are working: `check/claims/<batch>` (write the current
   time into it with the Write tool or `date > check/claims/<batch>`). Do this before every page.
3. Read the scan image `source/pages/nN.jpg` (use the Read tool; it shows the image).
4. Read the text `check/pages/nN.md`. It holds the paragraphs that begin on this page, plus the last
   paragraph begun on an earlier page, whose end may be at the top of this page.
5. Compare the scan with the text word by word, for the part of the text that is on this page only.
   Ignore the running head and page number at the top of the scan, and any library stamps.
6. Write `check/results/nN.tsv` (UTF-8). One line per problem, four fields separated by TABs:

   `find<TAB>replace<TAB>sure|unsure<TAB>note`

   - `find` is text copied **exactly** from `check/pages/nN.md` (same quotes, dashes, asterisks), long
     enough to be unique in the book: at least five words. It must not cross a paragraph break.
   - `replace` is the same text corrected to match the scan.
   - `sure` when the scan is clear; `unsure` when it is hard to read or you are not certain.
   - `note`: a few words, e.g. "scan has bear, not hear".
   - For a paragraph break that is wrong or missing, or anything you cannot express as a find/replace,
     write a line with `find` = the nearby text, `replace` = `?`, `unsure`, and explain in the note.
   - If the page has no problems, write the single line `OK`.

   Write the file even when the page is blank or has no text. Writing it marks the page done.

7. Go on to the next page. Do not stop until every page in your range has a results file.

## These differences are deliberate: do not report them

- Curly quotes and apostrophes; em dashes written as — with no spaces around them.
- No space before ; : ? ! (the scan has spaces there).
- Words split by a hyphen at the end of a printed line are joined. Real hyphenated words keep the hyphen.
- "today", "tomorrow" (the scan has to-day, to-morrow).
- Ordinary compounds in modern form: deathbed, dying bed, fig tree, olive tree, juniper tree, honeycomb,
  stumbling block(s), dwelling place, lodging place, goodwill, seedtime, vainglorious, looking glasses,
  burning glasses, fellow servant, marriage day, free grace, sin offering, tent door, seamarks, town ditch,
  cloakbag, plague sore, presence chamber, school divinity, tenderhearted.
- Spellings changed on purpose: woeful (woful), colic (cholic), hindrance (hinderance), rabbis (rabbies),
  embitter / embittered / embitters (imbitter…), entrusted (intrusted), encumbrances (incumbrances).
- `*Help* 2.` style: the label in italics, the number not (also Rule, Direction, Remedy, Means, Motive,
  Argument, Consideration, Question, Comfort).
- Italics are written `*like this*`. DO report italics that the scan has and the text lacks, or the reverse.
- Section headings like `### IV. Public Danger and Distraction` were added; the scan has the same words run in.
- The book's two printed footnotes appear as `[^ats]` / `[^const]` with their text as a separate paragraph.
- "Lavater", "Helvidius Priscus", "reeking", "Condé", "Nemo repente fit turpissimus" were corrected from a
  poor scan. Report them only if the scan clearly shows something else.

## Everything else that differs IS a problem: report it

Misread words (h/b, n/u, rn/m, c/e, l/i…), missing or extra words, wrong punctuation, wrong numbers in
Scripture references, missing or extra italics, wrong capitals, and paragraph breaks in the wrong place.

Do not edit any file except your results files and your claim file. When your range is finished,
reply with: batch name, pages done, and how many problem lines you wrote (sure / unsure).
