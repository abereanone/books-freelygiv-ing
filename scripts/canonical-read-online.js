// Runs after `astro build`. The hosted Read Online books (public/static/books/**.html) come
// from other pipelines (Courtney's sync, book-translate, make-booklet) and have no
// canonical tag, so Google listed them as "Duplicate without user-selected canonical".
// Cloudflare serves /x.html as a 308 to /x, so the canonical is the extensionless URL,
// the same one the sitemap lists. Only dist/ is changed; the source files stay as delivered.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const site = (process.env.SITE_URL ?? "https://books.freely.giving").replace(/\/$/, "");
const root = "dist";
const dir = join(root, "static", "books");

const walk = (d) =>
  readdirSync(d).flatMap((name) => {
    const p = join(d, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : [];
  });

let added = 0;
for (const file of walk(dir)) {
  const html = readFileSync(file, "utf8");
  if (/rel=["']canonical["']/i.test(html) || !/<\/head>/i.test(html)) continue;
  const path = "/" + relative(root, file).split(sep).join("/").replace(/\.html$/, "");
  const tag = `<link rel="canonical" href="${site}${path}">\n`;
  writeFileSync(file, html.replace(/<\/head>/i, tag + "</head>"));
  added++;
}
console.log(`canonical-read-online: added a canonical tag to ${added} Read Online page(s)`);
