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
  /* Sharper paintings (2026-11-23): little blur, so the picture's details show; readability
     comes from a soft dark patch right behind the text instead of darkening everything. */
  .card .bg{position:absolute;inset:-20px;background-size:cover;background-position:center;filter:brightness(.68) blur(.6px) saturate(.95)}
  .card .veil{position:absolute;inset:0;background:radial-gradient(ellipse 72% 52% at 50% 47%,rgba(0,0,0,.66) 0%,rgba(0,0,0,.42) 55%,rgba(0,0,0,.12) 100%)}
  .card .body{position:absolute;left:110px;right:110px;top:90px;bottom:170px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
  .card .q{font-family:Crimson;color:#fff;line-height:1.22;text-wrap:balance;hanging-punctuation:first last;text-shadow:0 2px 12px rgba(0,0,0,.5)}
  /* Author in the book-text face, bold, with an outline-like shadow: Medium Rare was hard to
     read at this size on busy paintings (Michael chose option B, 2026-11-22). */
  .card .who{margin-top:44px;font-family:Crimson;font-weight:600;color:${GOLD};font-size:62px;letter-spacing:.01em;text-shadow:0 0 14px rgba(0,0,0,.85),0 2px 4px rgba(0,0,0,.9)}
  .card .book{margin-top:6px;font-family:Crimson;font-style:italic;color:${CREAM};opacity:.85;font-size:36px;text-align:center;text-shadow:0 1px 6px rgba(0,0,0,.8)}
  .card .tag{position:absolute;left:64px;bottom:58px;font-family:Ribeye;color:${GOLD};font-size:30px;letter-spacing:.09em}
  /* Light cards: a bright sky painting washed pale, dark ink, deeper gold (light-NN paintings). */
  .card.light .bg{filter:brightness(1.03) blur(.6px) saturate(.95)}
  .card.light .veil{background:radial-gradient(ellipse 72% 52% at 50% 47%,rgba(255,252,244,.84) 0%,rgba(255,252,244,.6) 55%,rgba(255,252,244,.12) 100%)}
  .card:not(.framed) .tag{text-shadow:0 0 10px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.9)}
  .card.light .q{color:#1d2630;text-shadow:0 1px 14px rgba(255,255,255,.8)}
  .card.light .tag{color:#6b4e0e;text-shadow:0 0 10px rgba(255,255,255,1),0 0 4px rgba(255,255,255,1),0 0 2px rgba(255,255,255,1)}
  .card.light .who{color:#5e430a;text-shadow:0 0 12px rgba(255,255,255,.95),0 0 3px rgba(255,255,255,.9)}
  .card.light .book{color:#1d2630;opacity:.9;text-shadow:0 0 8px rgba(255,255,255,.9)}
  /* Solid cards: one colour with the double-line box and double L-brackets of the prepared-book
     covers (Keeping the Heart), in that colour's pale tint; tag centred below (2026-11-23). */
  .card.framed{background:var(--bg)}
  .framed .box{position:absolute;inset:44px;border:4px solid var(--pale)}
  .framed .box::after{content:'';position:absolute;inset:10px;border:2px solid color-mix(in srgb,var(--pale) 60%,transparent)}
  .framed .cb{position:absolute;width:96px;height:96px;border:0 solid var(--pale)}
  .framed .cb::after{content:'';position:absolute;width:62px;height:62px;border:0 solid color-mix(in srgb,var(--pale) 60%,transparent)}
  .framed .tl{left:76px;top:76px;border-left-width:4px;border-top-width:4px}.framed .tl::after{left:14px;top:14px;border-left-width:2px;border-top-width:2px}
  .framed .tr{right:76px;top:76px;border-right-width:4px;border-top-width:4px}.framed .tr::after{right:14px;top:14px;border-right-width:2px;border-top-width:2px}
  .framed .bl{left:76px;bottom:76px;border-left-width:4px;border-bottom-width:4px}.framed .bl::after{left:14px;bottom:14px;border-left-width:2px;border-bottom-width:2px}
  .framed .br{right:76px;bottom:76px;border-right-width:4px;border-bottom-width:4px}.framed .br::after{right:14px;bottom:14px;border-right-width:2px;border-bottom-width:2px}
  .framed .body{left:150px;right:150px;top:150px;bottom:200px}
  .framed .q{color:${CREAM};text-shadow:none}
  .framed .who{color:${GOLD};text-shadow:none}
  .framed .book{color:var(--pale);opacity:1;text-shadow:none}
  .framed .tag{left:0;right:0;bottom:104px;text-align:center}`;
}

// Solid-card colours: [background, pale tint]. The CROSSWORDS cover palettes (crosswords-books.md)
// plus teal; a quote's colour is stored as background.solid in quotes.yaml (render-cards.mjs).
export const SOLIDS = {
  evergreen: ["#1F4A3B", "#A9C9A4"],
  burgundy: ["#5A1626", "#E3B7A0"],
  navy: ["#14213D", "#A9BCE0"],
  violet: ["#3A2348", "#BCA6D6"],
  teal: ["#173F44", "#9CCBC6"],
  rust: ["#7A3517", "#E6B98F"],
};

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Straight apostrophes in titles become curly; quote text is left exactly as printed.
const curly = (s) => String(s ?? "").replace(/'/g, "’");

// A light-NN painting makes a light card; every other painting a dark one.
export const isLight = (file) => /^light-/.test(file || "");

// `solid` (a SOLIDS key) makes a framed solid-colour card; otherwise `bgUrl` is the painting.
export function cardHtml({ text, author, book, bgUrl, solid }) {
  const open = solid && SOLIDS[solid]
    ? `<div class="card framed" style="--bg:${SOLIDS[solid][0]};--pale:${SOLIDS[solid][1]}"><div class="box"></div><div class="cb tl"></div><div class="cb tr"></div><div class="cb bl"></div><div class="cb br"></div>`
    : `<div class="card${/\/light-[^/]*$/.test(bgUrl) ? " light" : ""}"><div class="bg" style="background-image:url('${bgUrl}')"></div><div class="veil"></div>`;
  return `${open}
  <div class="body"><div class="q">${esc(text)}</div><div class="who">${esc(author)}</div><div class="book">${esc(curly(book))}</div></div>
  <div class="tag">BOOKS.FREELY.GIVING</div></div>`;
}

// Shrinks the quote until the text block fits. Run in the page after fonts load.
export const FIT_JS = `function fitCards(root){root.querySelectorAll('.card .q').forEach(q=>{const b=q.parentElement;let s=q.closest('.framed')?88:96;q.style.fontSize=s+'px';while(s>40&&b.scrollHeight>b.clientHeight){s-=2;q.style.fontSize=s+'px'}})}`;

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
