// go-links: count clicks on links that leave the site.
//
// Runs after a static build. Every <a href="https://other-site/..."> in the built HTML is
// pointed at a short "go" address instead, which answers with a 302 to the real address.
// Cloudflare logs each go request, C:/code/site-stats archives those counts, and the stats
// report lists which outside links people follow.
//
//   node scripts/go-links.mjs [dist] --base URL [--own host,host] [--skip dir,dir]
//
//   dist     built site folder (default: dist)
//   --base   where go addresses live (default: /go/):
//              /go/                      on the site itself; this script writes the 302 rules to
//                                        dist/_redirects. Counts need the site's DNS on Cloudflare.
//              https://go.example.com/   a host served by the go-links Worker (this repo's src/),
//                                        for a site whose own domain Cloudflare does not log.
//   --own    hosts that are part of this site and stay as they are (besides relative links)
//   --skip   folders under dist to leave alone (e.g. static/books for hosted books)
//
// It writes:
//   dist/go/links.json  name -> { url, text, where, pages }: the Worker follows it, and reports use
//                       it to say where each name goes (text = the link's words, where = the title
//                       of the first page it is on)
//   dist/_redirects     the 302 rules, appended (only when --base is /go/)
//   dist/robots.txt     "Disallow: /go/" added (only when --base is /go/)
//
// A name is the destination's domain word plus a hash of the full URL ("lulu-k3x9qa"), so the
// same link keeps the same name on every build and its counts line up over time.
// Leave a link alone by giving it data-no-go. Canonical copy: C:/code/go-links/go-links.mjs;
// each site keeps its own copy in scripts/ because Cloudflare builds from the site's repo alone.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";

const argv = process.argv.slice(2);
const opt = (k, d = "") => { const i = argv.indexOf("--" + k); return i > -1 ? argv[i + 1] : d; };
const root = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--")) || "dist";
const base = opt("base", "/go/").replace(/\/?$/, "/");
const local = base.startsWith("/");
const own = new Set(opt("own").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
const skip = ["go", ...opt("skip").split(",")].map((d) => d.trim().replace(/^\/|\/$/g, "")).filter(Boolean);
if (!local) own.add(new URL(base).hostname.toLowerCase()); // never wrap a link that already goes through the go host

const walk = (d) =>
  readdirSync(d).flatMap((name) => {
    const p = join(d, name);
    const rel = relative(root, p).split(sep).join("/");
    if (skip.some((s) => rel === s || rel.startsWith(s + "/"))) return [];
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : [];
  });

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 120);

function nameFor(url) {
  const host = new URL(url).hostname.replace(/^www\./, "").split(".");
  const word = (host.length > 2 && host.at(-2).length <= 3 ? host.at(-3) : host.at(-2) || host[0]).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const hash = BigInt("0x" + createHash("sha1").update(url).digest("hex").slice(0, 12)).toString(36).slice(0, 6);
  return `${word}-${hash}`;
}

// Start from an existing list so running the script twice on the same dist loses nothing.
const listFile = join(root, "go", "links.json");
const links = existsSync(listFile) ? JSON.parse(readFileSync(listFile, "utf8")) : {}; // name -> { url, text, where, pages }
let rewritten = 0, files = 0;
for (const file of walk(root)) {
  const html = readFileSync(file, "utf8");
  const page = "/" + relative(root, file).split(sep).join("/").replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
  // The page's title without the site name ("Morning and Evening | Free Christian Books" -> "Morning and Evening").
  const where = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").split(/\s+[|–—·-]\s+/)[0] || page;
  let changed = false;
  // <a ...>link text</a>; only the href value inside the opening tag is changed.
  const out = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attrs, inner) => {
    if (/\bdata-no-go\b/i.test(attrs)) return whole;
    const m = attrs.match(/\bhref\s*=\s*(["'])(https?:\/\/[^"']+)\1/i);
    if (!m) return whole;
    const url = decode(m[2]);
    let host;
    try { host = new URL(url).hostname.toLowerCase(); } catch { return whole; }
    if (own.has(host)) return whole;
    const name = nameFor(url);
    const rec = (links[name] ||= { url, text: "", where, pages: [] });
    if (!rec.text) rec.text = text(inner) || text(attrs.match(/\b(?:aria-label|title)\s*=\s*(["'])(.*?)\1/i)?.[2] || "");
    if (!rec.pages.includes(page)) rec.pages.push(page);
    rewritten++;
    changed = true;
    return whole.replace(m[0], `href=${m[1]}${base}${name}${m[1]}`);
  });
  if (changed) { writeFileSync(file, out); files++; }
}

const names = Object.keys(links).sort();
mkdirSync(join(root, "go"), { recursive: true });
writeFileSync(listFile, JSON.stringify(Object.fromEntries(names.map((n) => [n, links[n]])), null, 1) + "\n");

if (local && names.length) {
  // Redirect rules. A destination with spaces would break the line format, so encode them.
  const red = join(root, "_redirects");
  const before = existsSync(red) ? readFileSync(red, "utf8").replace(/\n?# go-links start[\s\S]*?# go-links end\n?/, "\n") : "";
  const block = ["# go-links start (generated by scripts/go-links.mjs at build; do not edit)", ...names.map((n) => `${base}${n} ${links[n].url.replace(/ /g, "%20")} 302`), "# go-links end"].join("\n");
  writeFileSync(red, (before.trim() ? before.replace(/\s*$/, "\n") : "") + block + "\n");
  const robots = join(root, "robots.txt");
  if (existsSync(robots)) {
    const r = readFileSync(robots, "utf8");
    if (!new RegExp(`^Disallow:\\s*${base}\\s*$`, "m").test(r)) {
      writeFileSync(robots, /^User-agent:[ \t]*\*[ \t]*$/m.test(r) ? r.replace(/^(User-agent:[ \t]*\*[ \t]*)$/m, `$1\nDisallow: ${base}`) : `${r.replace(/\s*$/, "\n")}\nUser-agent: *\nDisallow: ${base}\n`);
    }
  }
}
console.log(`go-links: ${rewritten} outside link(s) in ${files} page(s) now go through ${base} (${names.length} distinct)`);
