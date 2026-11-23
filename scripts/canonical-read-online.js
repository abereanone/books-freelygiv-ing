// Runs after `astro build`. The hosted Read Online books (public/static/books/**.html) come
// from other pipelines (Courtney's sync, book-translate, make-booklet) and have no
// canonical tag, so Google listed them as "Duplicate without user-selected canonical".
// Cloudflare serves /x.html as a 308 to /x, so the canonical is the extensionless URL,
// the same one the sitemap lists. Only dist/ is changed; the source files stay as delivered.
//
// They had no share tags either, so a shared Read Online link showed no preview (2026-11-23).
// Each one now gets its book page's og:/twitter: tags (title, description, the book's share
// card), with og:url pointing at the Read Online page itself.
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

// Book slug -> that book page's share tags, from the built pages at dist/books/<author>/<slug>/.
const shareTags = {};
const booksDir = join(root, "books");
for (const author of readdirSync(booksDir)) {
  if (!statSync(join(booksDir, author)).isDirectory()) continue;
  for (const slug of readdirSync(join(booksDir, author))) {
    try {
      const page = readFileSync(join(booksDir, author, slug, "index.html"), "utf8");
      const tags = page.match(/<meta (?:property|name)="(?:og|twitter):[^"]+"[^>]*>/g);
      if (tags) shareTags[slug] = tags;
    } catch {}
  }
}

let added = 0;
let shared = 0;
for (const file of walk(dir)) {
  const html = readFileSync(file, "utf8");
  if (!/<\/head>/i.test(html)) continue;
  const path = "/" + relative(root, file).split(sep).join("/").replace(/\.html$/, "");
  let head = "";
  if (!/rel=["']canonical["']/i.test(html)) {
    head += `<link rel="canonical" href="${site}${path}">\n`;
    added++;
  }
  const slug = relative(dir, file).split(sep)[0];
  if (!/property=["']og:image["']/i.test(html) && shareTags[slug]) {
    head += shareTags[slug]
      .map((t) => (/"og:url"/.test(t) ? `<meta property="og:url" content="${site}${path}">` : t))
      .join("\n") + "\n";
    shared++;
  }
  if (head) writeFileSync(file, html.replace(/<\/head>/i, head + "</head>"));
}
console.log(`canonical-read-online: canonical tag on ${added}, share tags on ${shared} Read Online page(s)`);
