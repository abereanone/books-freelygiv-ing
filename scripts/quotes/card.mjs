// Shared by the review page and the card renderer: the look-B card template, and the
// background picker. Fonts are in scripts/quotes/fonts/, paintings in quote-art/ (gitignored).
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const ART_DIR = join(ROOT, "quote-art");
export const FONT_DIR = join(ROOT, "scripts/quotes/fonts");

export const GOLD = "#D9B65C", CREAM = "#F2EAD7";

// Card CSS. `base` is the URL prefix the fonts are served from.
export function cardCss(base) {
  return `
  @font-face{font-family:Crimson;src:url('${base}crimson-pro-latin-400-normal.woff2');font-weight:400}
  @font-face{font-family:Crimson;src:url('${base}crimson-pro-latin-600-normal.woff2');font-weight:600}
  @font-face{font-family:Crimson;src:url('${base}crimson-pro-latin-400-italic.woff2');font-style:italic}
  @font-face{font-family:Ribeye;src:url('${base}medium-rare-ribeye.ttf')}
  .card{position:relative;width:1080px;height:1080px;overflow:hidden;background:#111;box-sizing:border-box}
  .card *{box-sizing:border-box;margin:0}
  .card .bg{position:absolute;inset:-20px;background-size:cover;background-position:center;filter:brightness(.5) blur(4px) saturate(.8)}
  .card .veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,.35),rgba(0,0,0,.55))}
  .card .body{position:absolute;left:110px;right:110px;top:90px;bottom:170px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
  .card .q{font-family:Crimson;color:#fff;line-height:1.22;text-wrap:balance;hanging-punctuation:first last;text-shadow:0 2px 12px rgba(0,0,0,.5)}
  .card .who{margin-top:44px;font-family:Ribeye;color:${GOLD};font-size:46px;letter-spacing:.04em;text-shadow:0 2px 10px rgba(0,0,0,.4)}
  .card .book{margin-top:6px;font-family:Crimson;font-style:italic;color:${CREAM};opacity:.85;font-size:34px;text-align:center}
  .card .tag{position:absolute;left:64px;bottom:58px;font-family:Ribeye;color:${GOLD};font-size:30px;letter-spacing:.09em}
  /* Light cards: a bright sky painting washed pale, dark ink, deeper gold (light-NN paintings). */
  .card.light .bg{filter:brightness(1.06) blur(3px) saturate(.85)}
  .card.light .veil{background:radial-gradient(ellipse at 50% 45%,rgba(255,252,244,.66),rgba(255,252,244,.38))}
  .card.light .q{color:#1d2630;text-shadow:0 1px 14px rgba(255,255,255,.8)}
  .card.light .who,.card.light .tag{color:#7a5a12;text-shadow:0 1px 8px rgba(255,255,255,.7)}
  .card.light .book{color:#2f2f2f;opacity:.9}`;
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Straight apostrophes in titles become curly; quote text is left exactly as printed.
const curly = (s) => String(s ?? "").replace(/'/g, "’");

// A light-NN painting makes a light card; every other painting a dark one.
export const isLight = (file) => /^light-/.test(file || "");

export function cardHtml({ text, author, book, bgUrl }) {
  return `<div class="card${/\/light-[^/]*$/.test(bgUrl) ? " light" : ""}"><div class="bg" style="background-image:url('${bgUrl}')"></div><div class="veil"></div>
  <div class="body"><div class="q">${esc(text)}</div><div class="who">${esc(author)}</div><div class="book">${esc(curly(book))}</div></div>
  <div class="tag">BOOKS.FREELY.GIVING</div></div>`;
}

// Shrinks the quote until the text block fits. Run in the page after fonts load.
export const FIT_JS = `function fitCards(root){root.querySelectorAll('.card .q').forEach(q=>{const b=q.parentElement;let s=96;q.style.fontSize=s+'px';while(s>40&&b.scrollHeight>b.clientHeight){s-=2;q.style.fontSize=s+'px'}})}`;

// Paintings by mood, from quote-art/credits.json.
export function paintings() {
  const credits = JSON.parse(readFileSync(join(ART_DIR, "credits.json"), "utf8"));
  const byMood = {};
  for (const c of credits) (byMood[c.mood] ||= []).push(c.file);
  return { credits, byMood };
}

// Background for a quote: the painting of its first topic's mood that is used least so far
// (usage = {file: count} over quotes that already have one), ties broken by the quote id,
// so cards from one book spread across the set instead of repeating.
// `tone` ("light" | "dark") overrides the topic: light uses the light set; dark uses the
// topic's mood, or sky when the topic's own mood is light.
export function chooseBackground(q, topics, byMood, usage, tone) {
  let mood = topics[q.topics?.[0]]?.mood || "sky";
  if (tone === "light") mood = "light";
  else if (tone === "dark" && mood === "light") mood = "sky";
  const files = byMood[mood] || Object.values(byMood).flat();
  let h = 0;
  for (const ch of q.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [...files].sort((a, b) => (usage[a] || 0) - (usage[b] || 0) || ((h + files.indexOf(a)) % files.length) - ((h + files.indexOf(b)) % files.length))[0];
}
