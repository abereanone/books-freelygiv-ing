// Scripture references + BSB lookup, shared by convert.mjs and build.mjs.
import fs from 'node:fs';
import path from 'node:path';

const CONFIG = JSON.parse(fs.readFileSync(path.resolve('book.config.json'), 'utf8'));
// Another language: book.config.json has "langPack" (c:/code/book-translate/lang/<xx>.json) with book names, UI strings, Bible JSON.
const PACK = CONFIG.langPack ? JSON.parse(fs.readFileSync(CONFIG.langPack, 'utf8')) : null;
export const UI = {
  contents: 'Contents', introduction: 'Introduction', afterword: 'Afterword', aboutAuthor: 'About the Author',
  scriptureIndex: 'Scripture Index', ixNote: 'Links go to each place the passage is cited.', part: 'Part', chapter: 'Chapter',
  chapterShort: 'ch.', psalm: 'Psalm', psalmsBook: 'Psalms', whole: 'whole', cont: 'cont.', footnote: 'Footnote',
  ...(PACK?.ui || {}),
};
export const STANZA_NAMES = PACK?.stanzas || null;
export const HTML_LANG = PACK?.htmlLang || 'en';

// [code, display name, ...aliases]  (aliases matched case-insensitively, optional trailing ".")
const ENGLISH_BOOKS = [
  ['gen', 'Genesis', 'gen', 'ge', 'gn'],
  ['exo', 'Exodus', 'exod', 'exo', 'ex'],
  ['lev', 'Leviticus', 'lev', 'lv'],
  ['num', 'Numbers', 'num', 'nm'],
  ['deu', 'Deuteronomy', 'deut', 'deu', 'dt'],
  ['jos', 'Joshua', 'josh', 'jos'],
  ['jdg', 'Judges', 'judg', 'jdg'],
  ['rut', 'Ruth', 'ru'],
  ['1sa', '1 Samuel', '1 sam', '1sam', 'i samuel'],
  ['2sa', '2 Samuel', '2 sam', '2sam', 'ii samuel'],
  ['1ki', '1 Kings', '1 kgs', '1kgs', 'i kings'],
  ['2ki', '2 Kings', '2 kgs', '2kgs', 'ii kings'],
  ['1ch', '1 Chronicles', '1 chron', '1 chr'],
  ['2ch', '2 Chronicles', '2 chron', '2 chr'],
  ['ezr', 'Ezra'],
  ['neh', 'Nehemiah', 'neh'],
  ['est', 'Esther', 'esth'],
  ['job', 'Job'],
  ['psa', 'Psalm', 'psalms', 'ps', 'psa', 'pss'],
  ['pro', 'Proverbs', 'prov', 'pro', 'prv', 'pr'],
  ['ecc', 'Ecclesiastes', 'eccl', 'ecc', 'eccles'],
  ['sng', 'Song of Solomon', 'song of songs', 'song'],
  ['isa', 'Isaiah', 'isa', 'is'],
  ['jer', 'Jeremiah', 'jer'],
  ['lam', 'Lamentations', 'lam'],
  ['ezk', 'Ezekiel', 'ezek', 'eze'],
  ['dan', 'Daniel', 'dan', 'dn'],
  ['hos', 'Hosea', 'hos'],
  ['jol', 'Joel'],
  ['amo', 'Amos'],
  ['oba', 'Obadiah', 'obad'],
  ['jon', 'Jonah', 'jon'],
  ['mic', 'Micah', 'mic'],
  ['nah', 'Nahum', 'nah'],
  ['hab', 'Habakkuk', 'hab'],
  ['zep', 'Zephaniah', 'zeph'],
  ['hag', 'Haggai', 'hag'],
  ['zec', 'Zechariah', 'zech', 'zec'],
  ['mal', 'Malachi', 'mal'],
  ['mat', 'Matthew', 'matt', 'mat', 'mt'],
  ['mrk', 'Mark', 'mk', 'mrk'],
  ['luk', 'Luke', 'lk', 'luk'],
  ['jhn', 'John', 'jn', 'jhn'],
  ['act', 'Acts', 'act'],
  ['rom', 'Romans', 'rom', 'rm'],
  ['1co', '1 Corinthians', '1 cor', '1cor', 'i corinthians'],
  ['2co', '2 Corinthians', '2 cor', '2cor', 'ii corinthians'],
  ['gal', 'Galatians', 'gal'],
  ['eph', 'Ephesians', 'eph'],
  ['php', 'Philippians', 'phil', 'php'],
  ['col', 'Colossians', 'col'],
  ['1th', '1 Thessalonians', '1 thess', '1 th'],
  ['2th', '2 Thessalonians', '2 thess', '2 th'],
  ['1ti', '1 Timothy', '1 tim', '1tim'],
  ['2ti', '2 Timothy', '2 tim', '2tim'],
  ['tit', 'Titus', 'tit'],
  ['phm', 'Philemon', 'philem', 'phlm'],
  ['heb', 'Hebrews', 'heb'],
  ['jas', 'James', 'jas', 'jms'],
  ['1pe', '1 Peter', '1 pet', '1pet', '1 pt'],
  ['2pe', '2 Peter', '2 pet', '2pet', '2 pt'],
  ['1jn', '1 John', '1 jn', '1jn', '1 jo'],
  ['2jn', '2 John', '2 jn'],
  ['3jn', '3 John', '3 jn'],
  ['jud', 'Jude'],
  ['rev', 'Revelation', 'rev', 'revelations', 're'],
];
export const BOOKS = PACK ? PACK.books : ENGLISH_BOOKS;
export const SINGLE_CHAPTER = new Set(['oba', 'phm', '2jn', '3jn', 'jud']);
export const BOOK_ORDER = Object.fromEntries(BOOKS.map((b, i) => [b[0], i]));
export const BOOK_NAME = Object.fromEntries(BOOKS.map((b) => [b[0], b[1]]));
const ALIAS = new Map();
const noAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
for (const [code, name, ...al] of BOOKS) for (const a of [name, ...al]) { ALIAS.set(a.toLowerCase(), code); ALIAS.set(noAccents(a).toLowerCase(), code); }
// longest first so "1 John" wins over "John", "Song of Songs" over "Song"
const aliasRe = [...ALIAS.keys()]
  .sort((a, b) => b.length - a.length)
  .map((a) => a.replace(/ /g, '\\s+').replace(/\./g, '\\.'))
  .join('|');

// A reference chain: Book C:V[-V][, V][; C:V][; Book C:V] ...
// group 1 = whole chain. Whole-chapter refs ("Psalm 18") require a full book name.
const VERSE = String.raw`\d+(?::\d+)?(?:\s*[-–—]\s*\d+(?::\d+)?)?(?:\s*ff?\.?)?`;
// ", 1" must not be the start of "1 Peter" etc.
const NB = String.raw`(?!\s+(?:samuel|sam|kings|kgs|chronicles|chron|chr|corinthians|cor|thessalonians|thess|th|timothy|tim|peter|pet|pt|john|jn|jo|reyes|rey|crónicas|cronicas|corintios|tesalonicenses|tes|timoteo|pedro|ped|juan)\b)`;
const MORE = String.raw`(?:\s*,\s*\d+(?:\s*[-–—]\s*\d+)?(?!:)${NB})*`;
const SINGLE = PACK
  ? String.raw`(?:${['oba', 'phm', '2jn', '3jn', 'jud'].map((c) => BOOKS.find((b) => b[0] === c)[1].replace(/ /g, '\\s+')).join('|')})\s+\d+(?:\s*[-–—]\s*\d+)?(?![\d:])`
  : String.raw`(?:jude|philemon|obadiah|2\s+john|3\s+john)\s+\d+(?:\s*[-–—]\s*\d+)?(?![\d:])`;
const ONE = String.raw`(?:(?:${aliasRe})\.?\s+\d+:${VERSE}${MORE}|${SINGLE})`;
export const CHAIN = String.raw`${ONE}(?:\s*[;,]\s*(?:(?:(?:${aliasRe})\.?\s+)?\d+(?::\d+)?(?:\s*[-–—]\s*\d+(?::\d+)?)?${NB}${MORE}|${SINGLE}))*`;
export const REF_RE = new RegExp(String.raw`(?<![\w:])(${CHAIN})(?![\w:])`, 'gi');
export const CHAPTER_RE = new RegExp(
  String.raw`(?<![\w:])(${BOOKS.map((b) => b[1].replace(/ /g, '\\s+')).join('|')}|Psalms|Salmos)\s+(\d{1,3})(?![\w:])`,
  'g',
);

/** Parse one chain string into [{book, ch, v1, v2}] (v1=null for whole chapter). */
export function parseChain(s) {
  const out = [];
  let book = null;
  let ch = null;
  // pieces split on ; and , — any piece may start a new book ("Psalm 34:15, 1 Peter 3:12").
  // A bare number ("20-22") means verses of the current chapter (the author's usage).
  for (const part of s.split(/\s*[;,]\s*/)) {
    let piece = part.trim();
    const bm = piece.match(new RegExp(String.raw`^(${aliasRe})\.?\s+`, 'i'));
    if (bm) {
      book = ALIAS.get(bm[1].toLowerCase().replace(/\s+/g, ' '));
      piece = piece.slice(bm[0].length);
      ch = SINGLE_CHAPTER.has(book) ? 1 : null;
    }
    {
      piece = piece.replace(/\s*ff?\.?$/, '').trim();
      let m;
      if ((m = piece.match(/^(\d+):(\d+)\s*[-–—]\s*(\d+):(\d+)$/))) {
        // cross-chapter range: split
        const [c1, a, c2, b] = m.slice(1).map(Number);
        out.push({ book, ch: c1, v1: a, v2: lastVerse(book, c1) });
        for (let c = c1 + 1; c < c2; c++) out.push({ book, ch: c, v1: 1, v2: lastVerse(book, c) });
        out.push({ book, ch: c2, v1: 1, v2: b });
        ch = c2;
      } else if ((m = piece.match(/^(\d+):(\d+)(?:\s*[-–—]\s*(\d+))?$/))) {
        ch = +m[1];
        out.push({ book, ch, v1: +m[2], v2: m[3] ? +m[3] : +m[2] });
      } else if ((m = piece.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/)) && ch != null) {
        out.push({ book, ch, v1: +m[1], v2: m[2] ? +m[2] : +m[1], bare: true });
      }
    }
  }
  return out.filter((r) => r.book);
}

// ---------- BSB ----------
let BIBLE = null;
function load() {
  if (BIBLE) return BIBLE;
  BIBLE = {};
  if (PACK || CONFIG.divineName === 'Yahweh') {
    const j = JSON.parse(fs.readFileSync(PACK ? PACK.bible.json : CONFIG.bsbJson, 'utf8'));
    for (const [code, chapters] of Object.entries(j))
      BIBLE[code] = chapters.map((c) => Object.fromEntries(c.map((v) => [v.verse, v.text])));
  } else {
    // pristine BSB text: "Book C:V<TAB>text"
    const names = Object.fromEntries(BOOKS.map((b) => [b[1], b[0]]));
    Object.assign(names, { Psalm: 'psa', 'Song of Solomon': 'sng' });
    for (const line of fs.readFileSync(CONFIG.bsbTxt, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^(.+?) (\d+):(\d+)\t(.*)$/);
      if (!m || !names[m[1]]) continue;
      const code = names[m[1]];
      (BIBLE[code] ||= [])[+m[2] - 1] ||= {};
      BIBLE[code][+m[2] - 1][+m[3]] = m[4].trim();
    }
  }
  return BIBLE;
}
export function verse(book, ch, v) {
  return load()[book]?.[ch - 1]?.[v] ?? null;
}
export function lastVerse(book, ch) {
  const c = load()[book]?.[ch - 1];
  return c ? Math.max(...Object.keys(c).map(Number)) : 0;
}
export function exists(r) {
  return r.v1 == null ? !!load()[r.book]?.[r.ch - 1] : !!verse(r.book, r.ch, r.v1) && !!verse(r.book, r.ch, r.v2);
}
/** All verse objects (for fuzzy search). */
export function* allVerses() {
  for (const [book, chs] of Object.entries(load()))
    for (let c = 0; c < chs.length; c++) for (const [v, t] of Object.entries(chs[c] || {})) yield { book, ch: c + 1, v: +v, text: t };
}

/** "Romans 8:28–30" style label for one or more refs. */
export function label(refs) {
  const parts = [];
  let prevBook = null;
  let prevCh = null;
  for (const r of refs) {
    const vs = r.v1 == null ? '' : r.v1 === r.v2 ? `${r.v1}` : `${r.v1}–${r.v2}`;
    if (r.book === prevBook && r.ch === prevCh && vs) parts[parts.length - 1] += `, ${vs}`;
    else if (r.book === prevBook) parts.push(`; ${r.ch}${vs ? ':' + vs : ''}`);
    else parts.push(`${parts.length ? '; ' : ''}${BOOK_NAME[r.book]} ${r.ch}${vs ? ':' + vs : ''}`);
    prevBook = r.book;
    prevCh = r.ch;
  }
  return parts.join('').replace(/ ;/g, ';');
}

/** BSB text for refs; verse numbers as <sup> when more than one verse. */
export function text(refs, { numbers = true } = {}) {
  const multi = refs.length > 1 || refs.some((r) => r.v2 !== r.v1);
  const segs = refs.map((r) => {
    const vs = [];
    for (let v = r.v1; v <= r.v2; v++) {
      const t = verse(r.book, r.ch, v);
      if (t != null) vs.push((multi && numbers ? `<sup>${v}</sup>` : '') + t);
    }
    return vs.join(' ');
  });
  return segs.join(' … ');
}

export const config = CONFIG;
