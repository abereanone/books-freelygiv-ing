/**
 * Bulk-uploads book files (epub, pdf, zip) to Cloudflare R2.
 *
 * Setup:
 *   npm install @aws-sdk/client-s3
 *
 * Required environment variables (add to a .env file or set in your shell):
 *   R2_ACCOUNT_ID     — Cloudflare account ID (found in the R2 dashboard)
 *   R2_ACCESS_KEY_ID  — R2 API token access key
 *   R2_SECRET_KEY     — R2 API token secret key
 *   R2_BUCKET         — bucket name (e.g. books-freelygiv-ing)
 *
 * Usage:
 *   node scripts/upload-to-r2.js
 *
 * Only uploads files that don't already exist in the bucket (safe to re-run).
 * To force re-upload a file, delete it from R2 first.
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const DATA_SRC   = join(__dirname, '../data/src');
const BOOKS_SRC  = join(DATA_SRC, 'books');
const LEGACY_SRC = join(__dirname, '../freely-given-books-data/data/src');

// Files in freely-given-books-data/data/src/joe-conkle/ that need renaming
const LEGACY_FLAT = [
  { src: 'joe-conkle/OurSinHisMercy.pdf',           key: 'our-sin-his-mercy/our-sin-his-mercy.pdf' },
  { src: 'joe-conkle/OurSinHisMercy_print_ready.zip', key: 'our-sin-his-mercy/print-ready.zip' },
  { src: 'joe-conkle/book.html',                     key: 'our-sin-his-mercy/our-sin-his-mercy.html' },
];

// Load .env file if present
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
} catch {}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY, R2_BUCKET } = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_KEY || !R2_BUCKET) {
  console.error(`
Missing required environment variables. Create a .env file in the project root:

  R2_ACCOUNT_ID=your_account_id
  R2_ACCESS_KEY_ID=your_access_key
  R2_SECRET_KEY=your_secret_key
  R2_BUCKET=books-freelygiv-ing
`);
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_KEY },
});

const BOOK_EXTS = new Set(['.epub', '.pdf', '.zip', '.mobi', '.html']);

async function fileExistsInR2(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

function mimeType(filename) {
  const ext = extname(filename).toLowerCase();
  if (ext === '.epub') return 'application/epub+zip';
  if (ext === '.pdf')  return 'application/pdf';
  if (ext === '.zip')  return 'application/zip';
  if (ext === '.mobi') return 'application/x-mobipocket-ebook';
  return 'application/octet-stream';
}

async function main() {
  console.log(`\nUploading book files to R2 bucket: ${R2_BUCKET}\n`);

  let uploaded = 0;
  let skipped  = 0;

  // Scan data/src/books/<book-slug>/content/ (primary, ongoing)
  if (existsSync(BOOKS_SRC)) {
    for (const bookSlug of readdirSync(BOOKS_SRC)) {
      const bookDir = join(BOOKS_SRC, bookSlug);
      if (!statSync(bookDir).isDirectory()) continue;

      const contentDir = join(bookDir, 'content');
      if (!existsSync(contentDir)) continue;

      for (const file of readdirSync(contentDir)) {
        if (!BOOK_EXTS.has(extname(file).toLowerCase())) continue;

        const key      = `${bookSlug}/${file}`;
        const filePath = join(contentDir, file);

        if (await fileExistsInR2(key)) {
          console.log(`  skip  ${key}`);
          skipped++;
          continue;
        }

        const body = readFileSync(filePath);
        await s3.send(new PutObjectCommand({
          Bucket:      R2_BUCKET,
          Key:         key,
          Body:        body,
          ContentType: mimeType(file),
        }));
        console.log(`  upload  ${key}`);
        uploaded++;
      }
    }
  }

  // Scan freely-given-books-data/data/src/<author-slug>/<book-slug>/content/ (legacy structure)
  if (existsSync(LEGACY_SRC)) {
    for (const authorSlug of readdirSync(LEGACY_SRC)) {
      const authorDir = join(LEGACY_SRC, authorSlug);
      if (!statSync(authorDir).isDirectory()) continue;

      for (const bookSlug of readdirSync(authorDir)) {
        const bookDir    = join(authorDir, bookSlug);
        if (!statSync(bookDir).isDirectory()) continue;
        const contentDir = join(bookDir, 'content');
        if (!existsSync(contentDir)) continue;

        for (const file of readdirSync(contentDir)) {
          if (!BOOK_EXTS.has(extname(file).toLowerCase())) continue;

          const key      = `${bookSlug}/${file}`;
          const filePath = join(contentDir, file);

          if (await fileExistsInR2(key)) {
            console.log(`  skip  ${key}`);
            skipped++;
            continue;
          }

          const body = readFileSync(filePath);
          await s3.send(new PutObjectCommand({
            Bucket:      R2_BUCKET,
            Key:         key,
            Body:        body,
            ContentType: mimeType(file),
          }));
          console.log(`  upload  ${key}`);
          uploaded++;
        }
      }
    }
  }

  // Upload flat legacy files (our-sin-his-mercy from joe-conkle/)
  for (const { src, key } of LEGACY_FLAT) {
    const filePath = join(LEGACY_SRC, src);
    if (!existsSync(filePath)) {
      console.log(`  missing  ${src} (skipping)`);
      continue;
    }

    if (await fileExistsInR2(key)) {
      console.log(`  skip  ${key}`);
      skipped++;
      continue;
    }

    const body = readFileSync(filePath);
    await s3.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         key,
      Body:        body,
      ContentType: mimeType(key),
    }));
    console.log(`  upload  ${key}`);
    uploaded++;
  }

  console.log(`\nDone — ${uploaded} uploaded, ${skipped} already existed.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
