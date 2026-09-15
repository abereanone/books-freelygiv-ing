/**
 * Generates 1200x630 Open Graph cards into public/static/og/.
 *
 * Social sites crop og:image to ~1.91:1, which slices the title and byline off a
 * portrait book cover. These cards sit the cover (or photo) beside the text instead,
 * so nothing is cropped and the 384px-wide covers are never scaled up to full frame.
 *
 * Cards are COMMITTED to git, alongside manifest.json. Cloudflare's Linux builders have
 * no Georgia, so regenerating there would silently change every card's typeface — with
 * the cards committed and their signatures matching, the build step is a no-op on CI.
 *
 * A card rebuilds when its signature changes: the text on it, the source image's mtime,
 * and this script's own mtime. Run `npm run og` (or just `npm run build`) after editing
 * a title, adding a book, or hiding one, and commit the regenerated cards.
 *
 * `--force` rebuilds everything, for when you change the layout below.
 */
import { existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { getBooks, getAuthors, getContributors, personName, personPhotos } from "../src/lib/data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const OG_DIR = join(PUBLIC, "static/og");

const W = 1200;
const H = 630;
const PAD = 64;

const GROUND = "#faf7f0";
const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const RULE = "#d8d2c4";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Helvetica, Arial, sans-serif";
const SITE = "books.freely.giving";

// ── text helpers ─────────────────────────────────────────────────────────────

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Greedy wrap. Georgia averages ~0.5em per char; caps run wider, so weight them. */
function wrap(text, maxWidth, fontSize, maxLines = 4) {
  const width = (s) =>
    [...s].reduce((sum, ch) => {
      if (ch === " ") return sum + fontSize * 0.26;
      if (/[A-Z]/.test(ch)) return sum + fontSize * 0.62;
      if (/[ijlt.,'’!]/.test(ch)) return sum + fontSize * 0.28;
      if (/[mwMW]/.test(ch)) return sum + fontSize * 0.86;
      return sum + fontSize * 0.5;
    }, 0);

  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (width(next) > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && width(line) > maxWidth) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

function textBlock(lines, x, y, size, fill, family, lineHeight = 1.22) {
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * size * lineHeight}" font-family="${family}" font-size="${size}" fill="${fill}">${esc(l)}</text>`,
    )
    .join("");
}

// ── card composition ─────────────────────────────────────────────────────────

/**
 * One layout for everything: an image panel on the left, text on the right.
 * `art` is a resized buffer; `artBox` is where it lands.
 */
async function composeCard({ art, artBox, svgText, out }) {
  const bg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${W}" height="${H}" fill="${GROUND}"/>
       ${svgText}
     </svg>`,
  );

  const layers = [{ input: bg, top: 0, left: 0 }];
  if (art) layers.push({ input: art, top: artBox.top, left: artBox.left });

  await sharp({
    create: { width: W, height: H, channels: 3, background: GROUND },
  })
    .composite(layers)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(out);
}

/** Fit an image inside a box, preserving aspect, returning the buffer and placement. */
async function fitArt(src, boxW, boxH, { round = false } = {}) {
  // Round art is cropped to fill (a "contain" letterbox leaves opaque bars that the
  // circle mask can't remove, so the result reads as a rounded square, not a circle).
  const img = sharp(src).resize(boxW, boxH, {
    fit: round ? "cover" : "contain",
    position: "attention",
    background: { r: 250, g: 247, b: 240 },
  });
  const buf = await (round
    ? img
        .composite([
          {
            input: Buffer.from(
              `<svg width="${boxW}" height="${boxH}"><circle cx="${boxW / 2}" cy="${boxH / 2}" r="${Math.min(boxW, boxH) / 2}" fill="#fff"/></svg>`,
            ),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer()
    : img.png().toBuffer());
  return buf;
}

async function bookCard(book, out) {
  const coverPath = join(PUBLIC, book.path, book.cover);
  if (!existsSync(coverPath)) return false;

  const artH = H - PAD * 2;
  const artW = 340;
  const art = await fitArt(coverPath, artW, artH);
  const meta = await sharp(art).metadata();
  const left = PAD;
  const top = Math.round((H - meta.height) / 2);

  const textX = left + artW + 56;
  const textW = W - textX - PAD;

  // Split "Title: Subtitle" so the subtitle can sit smaller.
  const full = String(book.title ?? "");
  const idx = full.indexOf(": ");
  const main = idx > 0 ? full.slice(0, idx) : full;
  const sub = idx > 0 ? full.slice(idx + 2) : "";

  const titleSize = main.length > 42 ? 48 : 58;
  const titleLines = wrap(main, textW, titleSize, 3);
  const subLines = sub ? wrap(sub, textW, 30, 2) : [];

  const authors = (book.authors || []).map(personName).filter(Boolean).join(", ");

  const blockH =
    titleLines.length * titleSize * 1.22 + (subLines.length ? subLines.length * 30 * 1.25 + 18 : 0);
  let y = Math.round((H - blockH) / 2) + titleSize * 0.4;
  if (y < PAD + titleSize) y = PAD + titleSize;

  let svg = textBlock(titleLines, textX, y, titleSize, INK, SERIF);
  let cursor = y + titleLines.length * titleSize * 1.22;

  if (subLines.length) {
    cursor += 10;
    svg += textBlock(subLines, textX, cursor, 30, MUTED, SERIF, 1.25);
    cursor += subLines.length * 30 * 1.25;
  }

  if (authors) {
    cursor += 34;
    svg += `<line x1="${textX}" y1="${cursor - 26}" x2="${textX + 90}" y2="${cursor - 26}" stroke="${RULE}" stroke-width="2"/>`;
    svg += textBlock(wrap(authors, textW, 28, 2), textX, cursor + 6, 28, INK, SANS);
  }

  svg += `<text x="${textX}" y="${H - PAD}" font-family="${SANS}" font-size="22" fill="${MUTED}">${SITE}</text>`;

  await composeCard({ art, artBox: { top, left }, svgText: svg, out });
  return true;
}

async function personCard(person, role, out) {
  const rel = personPhotos(person, 1)[0];
  const src = rel && existsSync(join(PUBLIC, rel)) ? join(PUBLIC, rel) : null;

  // A person with no photo still gets a card — text alone, centred — so no page ever
  // falls back to the generic site image.
  const size = 320;
  const art = src ? await fitArt(src, size, size, { round: true }) : null;
  const left = PAD + 20;
  const top = Math.round((H - size) / 2);

  const textX = src ? left + size + 64 : PAD;
  const textW = W - textX - PAD;

  const name = personName(person);
  const nameSize = name.length > 22 ? 52 : 62;
  const nameLines = wrap(name, textW, nameSize, 2);

  let y = Math.round(H / 2) - 10;
  let svg = textBlock(nameLines, textX, y, nameSize, INK, SERIF);
  let cursor = y + nameLines.length * nameSize * 1.22;

  cursor += 22;
  svg += `<line x1="${textX}" y1="${cursor - 28}" x2="${textX + 90}" y2="${cursor - 28}" stroke="${RULE}" stroke-width="2"/>`;
  svg += `<text x="${textX}" y="${cursor + 4}" font-family="${SANS}" font-size="26" fill="${MUTED}">${esc(role)}</text>`;
  svg += `<text x="${textX}" y="${H - PAD}" font-family="${SANS}" font-size="22" fill="${MUTED}">${SITE}</text>`;

  await composeCard({ art, artBox: { top, left }, svgText: svg, out });
  return true;
}

/** Index pages: a row of cover spines / photos under a heading. */
async function montageCard({ images, title, subtitle, out, round = false }) {
  if (!images.length) return false;

  // Heading occupies the top ~190px; the strip fills the rest. Sizing is driven by
  // HEIGHT, not cell width — width-fitting leaves portrait covers stranded in a tall
  // band with big margins. Art is scaled to the band height, then the row is centred;
  // if it overflows, drop the last item and retry.
  const stripTop = 196;
  const stripH = H - stripTop - 56;
  const gap = 24;
  const maxRow = W - PAD * 2;

  // Circles scaled to the full band height would be enormous — cap them so a row of
  // faces reads as a group rather than two giant portraits.
  const artH = round ? 180 : stripH;

  let picked = images.slice(0, round ? 6 : 7);
  let sized = [];
  while (picked.length) {
    sized = [];
    for (const src of picked) {
      const buf = await fitArt(src, round ? artH : Math.round(artH * 1.4), artH, { round });
      const trimmed = await sharp(buf).trim().toBuffer();
      const m = await sharp(trimmed).metadata();
      sized.push({ buf: trimmed, w: m.width, h: m.height });
    }
    const total = sized.reduce((s, a) => s + a.w, 0) + gap * (sized.length - 1);
    if (total <= maxRow) break;
    picked = picked.slice(0, -1);
  }
  if (!sized.length) return false;

  const totalW = sized.reduce((s, a) => s + a.w, 0) + gap * (sized.length - 1);
  const layers = [];
  let x = Math.round((W - totalW) / 2);
  for (const a of sized) {
    layers.push({
      input: a.buf,
      left: x,
      top: Math.round(stripTop + (stripH - a.h) / 2),
    });
    x += a.w + gap;
  }

  let svg = `<text x="${PAD}" y="100" font-family="${SERIF}" font-size="68" fill="${INK}">${esc(title)}</text>`;
  if (subtitle)
    svg += `<text x="${PAD}" y="148" font-family="${SANS}" font-size="27" fill="${MUTED}">${esc(subtitle)}</text>`;
  svg += `<text x="${W - PAD}" y="100" text-anchor="end" font-family="${SANS}" font-size="22" fill="${MUTED}">${SITE}</text>`;

  const bg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${W}" height="${H}" fill="${GROUND}"/>${svg}
     </svg>`,
  );

  await sharp({ create: { width: W, height: H, channels: 3, background: GROUND } })
    .composite([{ input: bg, top: 0, left: 0 }, ...layers])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(out);
  return true;
}

// ── staleness ────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes("--force");
const MANIFEST = join(OG_DIR, "manifest.json");

/**
 * Cards are keyed by a signature of everything that appears on them, not by file mtime.
 * mtime alone is wrong twice over: retitling a book in book.yaml leaves the cover file
 * untouched, and hiding a book changes the montages without touching any image.
 */
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const nextManifest = {};

const stamp = (p) => (p && existsSync(p) ? String(statSync(p).mtimeMs) : "-");

function sign(parts) {
  return createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

/** Records the new signature and reports whether the card must be rebuilt. */
function needsBuild(name, signature) {
  nextManifest[name] = signature;
  if (FORCE) return true;
  if (!existsSync(join(OG_DIR, name))) return true;
  return manifest[name] !== signature;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OG_DIR, { recursive: true });

  const books = getBooks();
  const authors = getAuthors();
  const contributors = getContributors();

  let made = 0;
  let kept = 0;
  const skipped = [];

  // Every signature folds in the script's own mtime, so a layout change rebuilds all.
  const selfStamp = stamp(join(__dirname, "build-og.js"));

  for (const book of books) {
    const slug = book.path.split("/").pop();
    const name = `book-${slug}.jpg`;
    const cover = join(PUBLIC, book.path, book.cover);
    const sig = sign([
      selfStamp,
      book.title,
      (book.authors || []).map(personName),
      book.cover,
      stamp(cover),
    ]);
    if (!needsBuild(name, sig)) {
      kept++;
      continue;
    }
    (await bookCard(book, join(OG_DIR, name)))
      ? made++
      : skipped.push(`book ${slug} (no cover in public/)`);
  }

  const people = [
    ...authors.map((p) => [p, "Author"]),
    ...contributors.map((p) => [p, "Contributor"]),
  ];
  for (const [person, role] of people) {
    const name = `person-${person.slug}.jpg`;
    const photo = personPhotos(person, 1)[0];
    const sig = sign([
      selfStamp,
      personName(person),
      role,
      photo ?? "-",
      stamp(photo ? join(PUBLIC, photo) : null),
    ]);
    if (!needsBuild(name, sig)) {
      kept++;
      continue;
    }
    (await personCard(person, role, join(OG_DIR, name)))
      ? made++
      : skipped.push(`${role.toLowerCase()} ${person.slug}`);
  }

  // Index + listing pages.
  const coversByDate = [...books]
    .filter((b) => existsSync(join(PUBLIC, b.path, b.cover)))
    .sort((a, b) => String(b.addedDate ?? "").localeCompare(String(a.addedDate ?? "")));

  const photosOf = (people) =>
    people
      .map((p) => personPhotos(p, 1)[0])
      .filter(Boolean)
      .map((p) => join(PUBLIC, p))
      .filter(existsSync);

  const montages = [
    {
      name: "library.jpg",
      images: coversByDate.map((b) => join(PUBLIC, b.path, b.cover)),
      title: "Library",
      subtitle: `${books.length} freely given books`,
    },
    {
      name: "recently-added.jpg",
      images: coversByDate.map((b) => join(PUBLIC, b.path, b.cover)),
      title: "Recently Added",
      subtitle: "The newest additions",
    },
    {
      name: "authors.jpg",
      images: photosOf(authors),
      title: "Authors",
      subtitle: `${authors.length} authors`,
      round: true,
    },
    {
      name: "contributors.jpg",
      images: photosOf(contributors),
      title: "Contributors",
      subtitle: "The people behind the books",
      round: true,
    },
  ];

  for (const m of montages) {
    // The whole image list is in the signature, so hiding a book — which changes the
    // list without touching a file — rebuilds the montage.
    const sig = sign([selfStamp, m.title, m.subtitle, m.images, m.images.map(stamp)]);
    if (!needsBuild(m.name, sig)) {
      kept++;
      continue;
    }
    (await montageCard({ ...m, out: join(OG_DIR, m.name) })) ? made++ : skipped.push(m.name);
  }

  // Drop signatures for cards that no longer have a source, so a re-added book rebuilds.
  writeFileSync(MANIFEST, JSON.stringify(nextManifest, null, 2) + "\n");

  console.log(`[build-og] ${made} generated, ${kept} up to date → public/static/og/`);
  if (skipped.length) console.log(`[build-og] skipped: ${skipped.join(", ")}`);
}

main().catch((err) => {
  console.error("[build-og]", err);
  process.exit(1);
});
