// Apply exact replacements to one chapter:  node tools/apply.mjs <file-glob-prefix> < edits
// edits:  <<<\nold\n===\nnew\n>>>  (repeat). Each old text must occur exactly once.
// In new text: {{BSB:ref}} -> BSB text (verse numbers when >1 verse); {{BSBN:ref}} -> no numbers;
//              {{FN:ref}} -> "Label — text" for a footnote definition.
import fs from 'node:fs';
import path from 'node:path';
import { parseChain, text, label, exists } from './bible.mjs';
const pre = process.argv[2];
const dir = path.dirname(pre);
const file = fs.readdirSync(dir).find((f) => f.startsWith(path.basename(pre)));
const p = path.join(dir, file);
let s = fs.readFileSync(p, 'utf8');
const spec = fs.readFileSync(0, 'utf8').replace(/\r\n/g, '\n');
const expand = (t) => t.replace(/\{\{(BSB|BSBN|FN):([^}]+)\}\}/g, (_, k, ref) => {
  const r = parseChain(ref.trim());
  if (!r.length || !r.every(exists)) throw new Error('bad ref ' + ref);
  return k === 'FN' ? `${label(r)} — ${text(r)}` : text(r, { numbers: k === 'BSB' });
});
let n = 0;
for (const block of spec.split('<<<\n').slice(1)) {
  const i = block.indexOf('\n===\n');
  const old = block.slice(0, i);
  const neu = expand(block.slice(i + 5).replace(/\n?>>>\s*$/, ''));
  const c = s.split(old).length - 1;
  if (c !== 1) { console.error(`FAILED (${c} matches) in ${p}:\n${old.slice(0, 300)}`); process.exit(1); }
  s = s.replace(old, () => neu);
  n++;
}
fs.writeFileSync(p, s, 'utf8');
console.log(`${p}: ${n} edits`);
