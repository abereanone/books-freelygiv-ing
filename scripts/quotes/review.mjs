// Local page for reviewing candidate quotes: approve, reject, fix topics and Scripture.
//   node scripts/quotes/review.mjs        then open http://localhost:4330
// Every click saves straight into data/src/books/<slug>/quotes.yaml (comments kept).
// Run `python scripts/quotes/verify.py` afterwards; it checks the references you typed.
import http from "http";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { cardCss, cardHtml, FIT_JS, paintings, chooseBackground, ART_DIR, FONT_DIR } from "./card.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BOOKS = join(ROOT, "data/src/books");
const PORT = +process.env.PORT || 4330;

const readY = (f) => YAML.parse(readFileSync(f, "utf8"));
const topics = readY(join(ROOT, "data/src/quotes/topics.yaml"));
const { byMood } = paintings();

function personName(slug) {
  const f = join(ROOT, "data/src", slug, "person.yaml");
  if (!existsSync(f)) return slug;
  const p = readY(f)[0];
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

function bookSlugs() {
  return readdirSync(BOOKS).filter((s) => existsSync(join(BOOKS, s, "quotes.yaml")));
}

const paraCache = {};
function context(slug, text) {
  const f = join(ROOT, "tmp/quotes", slug, "paragraphs.jsonl");
  if (!existsSync(f)) return "";
  paraCache[slug] ||= readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).text);
  return paraCache[slug].find((t) => t.includes(text)) || "";
}

function allQuotes() {
  const out = [];
  for (const slug of bookSlugs()) {
    const b = readY(join(BOOKS, slug, "book.yaml"))[0];
    for (const q of readY(join(BOOKS, slug, "quotes.yaml")) || [])
      out.push({ ...q, background: q.background && typeof q.background === "object" ? q.background[q.tone || "dark"] : q.background, bookTitle: b.title, authorName: personName(q.author), context: context(slug, q.text) });
  }
  return out;
}

function usage() {
  const u = {};
  for (const q of allQuotes()) if (q.background) u[q.background] = (u[q.background] || 0) + 1;
  return u;
}

function update(slug, id, set) {
  const f = join(BOOKS, slug, "quotes.yaml");
  const doc = YAML.parseDocument(readFileSync(f, "utf8"));
  const items = doc.contents.items;
  const node = items.find((n) => n.get("id") === id);
  if (!node) throw new Error(`no quote ${id} in ${slug}`);
  for (const [k, v] of Object.entries(set)) {
    if (!["status", "topics", "scripture", "featured"].includes(k)) continue;
    const val = doc.createNode(v);
    if (Array.isArray(v)) val.flow = true;
    node.set(k, val);
  }
  if (set.tone) {
    // Both looks are made; once the page has picked a painting for each (background: {dark, light}),
    // switching only changes which one shows first.
    if (YAML.isMap(node.get("background", true))) node.set("tone", set.tone);
    else node.set("background", chooseBackground(node.toJSON(), topics, byMood, usage(), set.tone));
  }
  if (set.status === "approved" && !node.get("background")) {
    const q = node.toJSON();
    node.set("background", chooseBackground(q, topics, byMood, usage()));
  }
  writeFileSync(f, doc.toString({ lineWidth: 0, flowCollectionPadding: false }), "utf8");
  return node.toJSON();
}

const TYPES = { ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf" };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/") return send(res, 200, "text/html; charset=utf-8", PAGE);
    if (url.pathname === "/api/quotes") {
      const u = usage();
      const qs = allQuotes().map((q) => ({ ...q, previewBg: q.background || chooseBackground(q, topics, byMood, u) }));
      return send(res, 200, "application/json", JSON.stringify({ quotes: qs, topics }));
    }
    if (url.pathname === "/api/update" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { book, id, set } = JSON.parse(body);
          send(res, 200, "application/json", JSON.stringify(update(book, id, set)));
        } catch (e) { send(res, 400, "text/plain", String(e.message)); }
      });
      return;
    }
    const m = url.pathname.match(/^\/(art|fonts)\/([\w.-]+)$/);
    if (m) {
      const f = join(m[1] === "art" ? ART_DIR : FONT_DIR, m[2]);
      if (existsSync(f)) return send(res, 200, TYPES[extname(f)] || "application/octet-stream", readFileSync(f));
    }
    send(res, 404, "text/plain", "not found");
  } catch (e) { send(res, 500, "text/plain", String(e.stack)); }
}).listen(PORT, () => console.log(`Quote review: http://localhost:${PORT}`));

function send(res, code, type, body) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quote review</title><style>
${cardCss("/fonts/")}
:root{--bg:#f6f3ec;--ink:#1a1a1a;--muted:#6b6b6b;--line:#ddd6c6;--ok:#2e7d4f;--no:#a33;--accent:#7a5c12}
@media (prefers-color-scheme:dark){:root{--bg:#1b1b1a;--ink:#eee;--muted:#a9a49a;--line:#3a3833;--accent:#d9b65c}}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--ink)}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
header b{font-size:17px;margin-right:8px}select,input,button{font:inherit}
.counts{color:var(--muted);margin-left:auto}
main{display:grid;grid-template-columns:minmax(0,560px) minmax(0,1fr);gap:24px;padding:16px;max-width:1300px;margin:auto}
@media (max-width:900px){main{grid-template-columns:1fr}}
.preview{width:540px;max-width:100%;aspect-ratio:1;overflow:hidden;border-radius:6px;position:relative}
.preview .card{transform:scale(.5);transform-origin:0 0;position:absolute}
.meta h2{margin:0 0 4px;font-size:18px}.muted{color:var(--muted)}
.status{display:inline-block;padding:2px 8px;border-radius:10px;font-size:13px;border:1px solid var(--line)}
.status.approved{background:var(--ok);color:#fff;border-color:var(--ok)}.status.rejected{background:var(--no);color:#fff;border-color:var(--no)}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.actions button{padding:8px 14px;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer}
.actions .approve{background:var(--ok);color:#fff;border-color:var(--ok)}.actions .reject{background:var(--no);color:#fff;border-color:var(--no)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 14px}.chip{padding:3px 9px;border-radius:12px;border:1px solid var(--line);cursor:pointer;font-size:13px;background:transparent;color:var(--ink)}
.chip.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.ctx{border-left:3px solid var(--line);padding:6px 12px;font-family:Georgia,serif;font-size:15px;max-height:220px;overflow:auto}.ctx mark{background:#f3e3a8;color:#000}
label{display:block;font-weight:600;margin-top:10px}input[type=text]{width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:4px;background:transparent;color:var(--ink)}
.keys{font-size:13px;color:var(--muted);margin-top:16px}kbd{border:1px solid var(--line);border-radius:3px;padding:0 4px}
.nav{display:flex;gap:8px;align-items:center;margin-top:10px}
</style></head><body>
<header><b>Quote review</b>
<select id="fBook"><option value="">All books</option></select>
<select id="fStatus"><option value="candidate">Candidates</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option></select>
<span class="counts" id="counts"></span></header>
<main><div><div class="preview" id="preview"></div>
<div class="nav"><button id="prev">&larr; Prev</button><span id="pos" class="muted"></span><button id="next">Next &rarr;</button></div></div>
<div class="meta" id="meta"></div></main>
<script>
${FIT_JS}
const CARD=${cardHtml.toString()};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const curly=s=>String(s??'').replace(/'/g,'\\u2019');
let Q=[],T={},list=[],i=0;
const $=id=>document.getElementById(id);
async function load(){const r=await (await fetch('/api/quotes')).json();Q=r.quotes;T=r.topics;
  const books=[...new Map(Q.map(q=>[q.book,q.bookTitle]))];$('fBook').innerHTML='<option value="">All books</option>'+books.map(([s,t])=>'<option value="'+s+'">'+esc(t)+'</option>').join('');
  filter();}
function filter(keep){const b=$('fBook').value,s=$('fStatus').value;const cur=list[i]?.id;
  list=Q.filter(q=>(!b||q.book===b)&&(!s||q.status===s));i=keep&&cur?Math.max(0,list.findIndex(q=>q.id===cur)):0;if(i<0)i=0;show();}
function counts(){const c={candidate:0,approved:0,rejected:0};Q.forEach(q=>c[q.status]++);$('counts').textContent=c.approved+' approved · '+c.candidate+' to review · '+c.rejected+' rejected';}
function show(){counts();const q=list[i];$('pos').textContent=list.length?(i+1)+' of '+list.length:'nothing here';
  if(!q){$('preview').innerHTML='';$('meta').innerHTML='<p class="muted">No quotes in this view.</p>';return}
  $('preview').innerHTML=CARD({text:q.text,author:q.authorName,book:q.bookTitle,bgUrl:'/art/'+(q.background||q.previewBg)});
  document.fonts.ready.then(()=>fitCards($('preview')));
  const ctx=q.context?esc(q.context).replace(esc(q.text),'<mark>'+esc(q.text)+'</mark>'):'';
  $('meta').innerHTML='<h2>'+esc(q.authorName)+', <i>'+esc(curly(q.bookTitle))+'</i></h2>'
   +'<div class="muted">'+esc(q.chapter)+' · '+q.words+' words · <span class="status '+q.status+'">'+q.status+'</span>'+(q.featured?' · ★ featured':'')+'</div>'
   +'<div class="actions"><button class="approve" onclick="setStatus(\\'approved\\')">Approve (A)</button><button class="reject" onclick="setStatus(\\'rejected\\')">Reject (R)</button>'
   +'<button onclick="setStatus(\\'candidate\\')">Undo (U)</button><button onclick="toggleFeatured()">'+(q.featured?'Unfeature':'Feature')+' (F)</button><button onclick="toggleTone()">'+(isLightQ(q)?'Make dark':'Make light')+' (L)</button></div>'
   +'<label>Topics <span class="muted">(1 to 3; the first one picks the painting)</span></label><div class="chips">'
   +Object.entries(T).map(([k,v])=>'<button class="chip'+(q.topics.includes(k)?' on':'')+'" onclick="toggleTopic(\\''+k+'\\')">'+(q.topics.includes(k)?(q.topics.indexOf(k)+1)+'. ':'')+esc(v.label)+'</button>').join('')+'</div>'
   +'<label for="scr">Scripture <span class="muted">(comma-separated, one verse each, e.g. Romans 8:13)</span></label><input type="text" id="scr" value="'+esc((q.scripture||[]).join(', '))+'" onchange="setScripture(this.value)">'
   +'<label>In the book</label><div class="ctx">'+ctx+'</div>'
   +'<div class="keys"><kbd>A</kbd> approve and next · <kbd>R</kbd> reject and next · <kbd>U</kbd> undo · <kbd>F</kbd> feature · <kbd>L</kbd> light/dark ·<kbd>&larr;</kbd><kbd>&rarr;</kbd> move. Saves as you go.</div>';}
async function save(set){const q=list[i];const r=await fetch('/api/update',{method:'POST',body:JSON.stringify({book:q.book,id:q.id,set})});
  if(!r.ok){alert(await r.text());return false}Object.assign(q,await r.json());return true}
async function setStatus(s){if(await save({status:s})){const st=$('fStatus').value;if(st&&st!==s){const at=i;filter(false);i=Math.max(0,Math.min(at,list.length-1));show()}else{if(s!=='candidate'&&i<list.length-1)i++;show()}}}
async function toggleTopic(k){const q=list[i];let t=q.topics.includes(k)?q.topics.filter(x=>x!==k):[...q.topics,k];if(t.length>3){alert('At most 3 topics.');return}if(!t.length){alert('At least 1 topic.');return}if(await save({topics:t}))show()}
async function setScripture(v){const s=v.split(',').map(x=>x.trim()).filter(Boolean);if(await save({scripture:s}))show()}
const isLightQ=q=>/^light-/.test(q.background||q.previewBg);
async function toggleTone(){if(await save({tone:isLightQ(list[i])?'dark':'light'}))show()}
async function toggleFeatured(){if(await save({featured:!list[i].featured}))show()}
$('prev').onclick=()=>{if(i>0){i--;show()}};$('next').onclick=()=>{if(i<list.length-1){i++;show()}};
$('fBook').onchange=()=>filter();$('fStatus').onchange=()=>filter();
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();
  if(k==='a')setStatus('approved');else if(k==='r')setStatus('rejected');else if(k==='u')setStatus('candidate');else if(k==='f')toggleFeatured();else if(k==='l')toggleTone();
  else if(k==='arrowright'||k==='j')$('next').click();else if(k==='arrowleft'||k==='k')$('prev').click();});
load();
</script></body></html>`;
