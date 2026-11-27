// The interior's page count for the spine, from the PDF the build made (dist/print-facts.json, written by
// tools/build.mjs --pdf), so the spine cannot go stale (adopted from Courtney's colophon, 2026-11-27).
// --pages=N still overrides it; --pdf=NAME picks another interior (default: the one built last).
const fs = require('fs'), path = require('path');
module.exports = function interiorPages() {
  const arg = process.argv.find((a) => a.startsWith('--pages='));
  if (arg) return +arg.slice(8);
  const f = path.resolve('dist', 'print-facts.json');
  if (!fs.existsSync(f)) {
    console.error('No dist/print-facts.json: build the interior first (node tools/build.mjs --pdf), from the project root, or pass --pages=N');
    process.exit(1);
  }
  const facts = JSON.parse(fs.readFileSync(f, 'utf8'));
  const name = process.argv.find((a) => a.startsWith('--pdf='))?.slice(6) || facts.latest;
  if (!facts.pdfs[name]) { console.error(`dist/print-facts.json has no ${name}; built: ${Object.keys(facts.pdfs).join(', ')}`); process.exit(1); }
  console.log(`spine for ${name}: ${facts.pdfs[name].pages} pages`);
  return facts.pdfs[name].pages;
};
