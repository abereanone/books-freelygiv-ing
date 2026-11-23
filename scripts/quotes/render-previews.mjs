// Small (540 px) light and dark previews of every candidate quote, plus seed.json for the
// phone review page. node scripts/quotes/render-previews.mjs
// Out: tmp/quotes/phone-review/cards/<id>-dark.jpg, <id>-light.jpg, seed.json
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";
import YAML from "yaml";
import { cardCss, cardHtml, FIT_JS, ART_DIR, FONT_DIR, paintings, chooseBackground } from "./card.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BOOKS = join(ROOT, "data/src/books");
const OUT = join(ROOT, "tmp/quotes/phone-review");
mkdirSync(join(OUT, "cards"), { recursive: true });
const require = createRequire(import.meta.url);
const puppeteer = require("C:/code/keeping-the-heart/node_modules/puppeteer-core");
const u = (p) => pathToFileURL(p).href;
const readY = (f) => YAML.parse(readFileSync(f, "utf8"));
const topics = readY(join(ROOT, "data/src/quotes/topics.yaml"));
const { byMood } = paintings();

const person = (slug) => { const p = readY(join(ROOT, "data/src", slug, "person.yaml"))[0]; return `${p.firstName} ${p.lastName}`; };
const paras = {};
const context = (slug, text) => {
  paras[slug] ||= readFileSync(join(ROOT, "tmp/quotes", slug, "paragraphs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).text);
  return paras[slug].find((t) => t.includes(text)) || "";
};

const quotes = [];
for (const slug of readdirSync(BOOKS).filter((s) => existsSync(join(BOOKS, s, "quotes.yaml")))) {
  const title = readY(join(BOOKS, slug, "book.yaml"))[0].title;
  for (const q of readY(join(BOOKS, slug, "quotes.yaml"))) if (q.status !== "rejected") quotes.push({ ...q, bookTitle: title, authorName: person(q.author) });
}

const usage = {};
const bump = (f) => (usage[f] = (usage[f] || 0) + 1);
const seed = [];
for (const q of quotes) {
  const bgDark = q.background && !/^light-/.test(q.background) ? q.background : chooseBackground(q, topics, byMood, usage, "dark");
  const bgLight = q.background && /^light-/.test(q.background) ? q.background : chooseBackground(q, topics, byMood, usage, "light");
  bump(bgDark); bump(bgLight);
  const defaultTone = q.background ? (/^light-/.test(q.background) ? "light" : "dark") : topics[q.topics[0]]?.mood === "light" ? "light" : "dark";
  seed.push({ id: q.id, book: q.book, bookTitle: q.bookTitle, author: q.author, authorName: q.authorName, text: q.text,
    chapter: q.chapter, words: q.words, topics: q.topics, scripture: q.scripture || [], status: q.status,
    featured: !!q.featured, tone: defaultTone, bgDark, bgLight, context: context(q.book, q.text) });
  q._bg = { dark: bgDark, light: bgLight };
}
writeFileSync(join(OUT, "seed.json"), JSON.stringify(seed, null, 1));

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 0.5 });
const tmp = join(OUT, "_card.html");
let n = 0;
for (const q of quotes) for (const tone of ["dark", "light"]) {
  const file = join(OUT, "cards", `${q.id}-${tone}.jpg`);
  writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>body{margin:0}${cardCss(u(FONT_DIR) + "/")}</style>
${cardHtml({ text: q.text, author: q.authorName, book: q.bookTitle, bgUrl: u(join(ART_DIR, q._bg[tone])) })}
<script>${FIT_JS};document.fonts.ready.then(()=>{fitCards(document);document.body.dataset.ready=1})</script>`);
  await page.goto(u(tmp));
  await page.waitForSelector("body[data-ready]");
  await page.screenshot({ path: file, type: "jpeg", quality: 78 });
  n++;
}
unlinkSync(tmp);
await browser.close();
console.log(`${seed.length} quotes, ${n} previews in ${OUT}`);
