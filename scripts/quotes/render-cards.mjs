// Renders every public quote card (status not "rejected") in all three looks (painting dark,
// painting light, solid colour), at two sizes:
//   <id>-<tone>.jpg       1080x1080, for download, sharing and og:image
//   <id>-<tone>-480.jpg   480x480, for the /quotes/ grid
// into public/static/quotes/ (gitignored; `astro dev` serves it). Production serves the same
// files from R2: files.books.freelygiv.ing/quotes/ (node scripts/quotes/upload-cards.mjs).
// A card re-renders only when its text, author, book, painting or this template changes.
//   node scripts/quotes/render-cards.mjs [--force]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createHash } from "crypto";
import { createRequire } from "module";
import YAML from "yaml";
import sharp from "sharp";
import { cardCss, cardHtml, FIT_JS, ART_DIR, FONT_DIR, SOLIDS, paintings, chooseBackground } from "./card.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BOOKS = join(ROOT, "data/src/books");
const OUT = join(ROOT, "public/static/quotes");
const MANIFEST = join(OUT, "manifest.json");
const FORCE = process.argv.includes("--force");
mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
const puppeteer = require("C:/code/keeping-the-heart/node_modules/puppeteer-core");
const u = (p) => pathToFileURL(p).href;
const readY = (f) => YAML.parse(readFileSync(f, "utf8"));
// a name-only author (no person page, e.g. "Thomas Gouge") is its own name
const person = (slug) => { const f = join(ROOT, "data/src", slug, "person.yaml"); if (!existsSync(f)) return slug; const p = readY(f)[0]; return `${p.firstName} ${p.lastName}`.trim(); };
const templateSig = createHash("sha1").update(readFileSync(join(ROOT, "scripts/quotes/card.mjs"))).digest("hex").slice(0, 8);

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const slugs = readdirSync(BOOKS).filter((s) => existsSync(join(BOOKS, s, "quotes.yaml")));
// Verse cards also carry CONFESS.CATECHIZE.ING (the site of the BSB master text), bottom right
// opposite BOOKS.FREELY.GIVING; on a framed card the two are stacked and centred. Kept here, not
// in card.mjs, because card.mjs is hashed into every card's signature (2026-11-23).
const TAG2 = "CONFESS.CATECHIZE.ING";
const TAG2_CSS = `.card:not(.framed) .tag2{left:auto;right:46px}
.framed .tag:not(.tag2){bottom:150px}.framed .tag2{bottom:104px}.framed .body{top:130px;bottom:240px}`;
const TAG2_SIG = "tag2-v1:" + TAG2 + TAG2_CSS;
// Every quotes file, with what goes in the card's author and book lines. Bible verse cards
// (data/src/quotes/scripture.yaml) show the reference and "Berean Standard Bible".
const SCRIPTURE = join(ROOT, "data/src/quotes/scripture.yaml");
const sources = [
  ...slugs.map((slug) => {
    const title = readY(join(BOOKS, slug, "book.yaml"))[0].title;
    return { file: join(BOOKS, slug, "quotes.yaml"), title, who: (q) => q.writtenBy || person(q.author), sigWho: (q) => q.writtenBy || q.author };
  }),
  ...(existsSync(SCRIPTURE) ? [{ file: SCRIPTURE, title: "Berean Standard Bible", who: (q) => q.ref, sigWho: (q) => `${q.ref}|${TAG2_SIG}`, tag2: true }] : []),
];

// Give every quote what it lacks, and write it into quotes.yaml so it never changes:
//  - background.dark / background.light: the least-used painting of its first topic's mood
//    (and of the bright "light" set), via chooseBackground in card.mjs;
//  - background.solid: the least-used of the six colours;
//  - tone (the look shown first): light for hopeful topics, otherwise every other quote solid,
//    the rest dark, for variety in the gallery.
const topics = readY(join(ROOT, "data/src/quotes/topics.yaml"));
const { byMood } = paintings();
const used = Object.fromEntries(Object.keys(SOLIDS).map((k) => [k, 0]));
const paintUse = {};
let darkSeen = 0;
for (const { file } of sources) for (const q of readY(file) || []) {
  const b = q.background || {};
  if (b.solid && used[b.solid] !== undefined) used[b.solid]++;
  for (const f of [b.dark, b.light]) if (f) paintUse[f] = (paintUse[f] || 0) + 1;
  if (q.tone === "dark" || q.tone === "solid") darkSeen++;
}
for (const { file } of sources) {
  const doc = YAML.parseDocument(readFileSync(file, "utf8"));
  let changed = false;
  for (const node of doc.contents.items) {
    if (node.get("status") === "rejected") continue;
    const q = node.toJSON();
    let bg = node.get("background", true);
    if (!YAML.isMap(bg)) { bg = doc.createNode({}); bg.flow = true; node.set("background", bg); changed = true; }
    for (const tone of ["dark", "light"]) {
      if (bg.get(tone)) continue;
      const f = chooseBackground(q, topics, byMood, paintUse, tone);
      paintUse[f] = (paintUse[f] || 0) + 1;
      bg.set(tone, f);
      changed = true;
    }
    if (!bg.get("solid")) {
      const pick = Object.keys(used).sort((a, b) => used[a] - used[b])[0];
      used[pick]++;
      bg.set("solid", pick);
      changed = true;
    }
    if (!node.get("tone")) {
      const light = topics[q.topics?.[0]]?.mood === "light";
      node.set("tone", light ? "light" : darkSeen++ % 2 === 1 ? "solid" : "dark");
      changed = true;
    }
  }
  if (changed) writeFileSync(file, doc.toString({ lineWidth: 0, flowCollectionPadding: false }), "utf8");
}

const jobs = [];
for (const { file, title, who, sigWho, tag2 } of sources) {
  for (const q of readY(file) || []) {
    if (q.status === "rejected") continue;
    for (const tone of ["dark", "light", "solid"]) {
      const bg = q.background?.[tone];
      if (!bg) { console.warn(`no ${tone} background for ${q.id}; run the review pull first`); continue; }
      const key = `${q.id}-${tone}`;
      const sig = createHash("sha1").update([q.text, sigWho(q), title, bg, templateSig].join("|")).digest("hex");
      if (!FORCE && manifest[key] === sig && existsSync(join(OUT, `${key}.jpg`))) continue;
      jobs.push({ key, sig, text: q.text, author: who(q), book: title, bg, solid: tone === "solid" ? bg : null, tag2: !!tag2 });
    }
  }
}

if (jobs.length) {
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080 });
  const tmp = join(OUT, "_card.html");
  for (const j of jobs) {
    let card = cardHtml({ text: j.text, author: j.author, book: j.book, bgUrl: j.solid ? "" : u(join(ART_DIR, j.bg)), solid: j.solid });
    if (j.tag2) card = card.replace(/<\/div>$/, `<div class="tag tag2">${TAG2}</div></div>`);
    writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>body{margin:0}${cardCss(u(FONT_DIR) + "/")}${j.tag2 ? TAG2_CSS : ""}</style>
${card}
<script>${FIT_JS};document.fonts.ready.then(()=>{fitCards(document);document.body.dataset.ready=1})</script>`);
    await page.goto(u(tmp));
    await page.waitForSelector("body[data-ready]");
    const png = await page.screenshot({ type: "png" });
    await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(join(OUT, `${j.key}.jpg`));
    await sharp(png).resize(480, 480).jpeg({ quality: 78, mozjpeg: true }).toFile(join(OUT, `${j.key}-480.jpg`));
    manifest[j.key] = j.sig;
  }
  unlinkSync(tmp);
  await browser.close();
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
}
// Version stamp for the image URLs (?v=…): changes whenever any card changes, so browsers and
// the CDN fetch the new images instead of a cached copy. Committed; read by quoteImage().
const version = createHash("sha1").update(JSON.stringify(Object.entries(manifest).sort())).digest("hex").slice(0, 8);
writeFileSync(join(ROOT, "data/src/quotes/cards-version.txt"), version + "\n");
const files = readdirSync(OUT).filter((f) => f.endsWith(".jpg"));
const mb = files.reduce((s, f) => s + statSync(join(OUT, f)).size, 0) / 1e6;
console.log(`${jobs.length} card(s) rendered; ${files.length} files, ${mb.toFixed(1)} MB in public/static/quotes/`);
