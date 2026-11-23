// Uploads rendered quote cards (public/static/quotes/*.jpg) to R2 under quotes/, served at
// https://files.books.freelygiv.ing/quotes/. Skips files already there with the same size.
// Needs the same .env as scripts/upload-to-r2.js. Run after render-cards.mjs, before pushing.
//   node scripts/quotes/upload-cards.mjs [--force]
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = join(ROOT, "public/static/quotes");
const FORCE = process.argv.includes("--force");
if (existsSync(join(ROOT, ".env")))
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_KEY || !R2_BUCKET) { console.error("Missing R2_* settings in .env"); process.exit(1); }

const s3 = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_KEY } });

let up = 0, skip = 0;
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".jpg"))) {
  const Key = `quotes/${f}`, body = readFileSync(join(DIR, f));
  if (!FORCE) {
    try { const h = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key })); if (h.ContentLength === body.length) { skip++; continue; } } catch {}
  }
  await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key, Body: body, ContentType: "image/jpeg",
    CacheControl: "public, max-age=86400" }));
  up++;
}
console.log(`${up} uploaded, ${skip} already there`);
