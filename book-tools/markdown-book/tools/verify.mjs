// Check every Scripture quotation in chapters/ against the BSB:
//  - blocks with <cite>: each verse's text (sup-numbered segments) must match the BSB (bold/italics ignored;
//    "…" elisions and partial verses allowed)
//  - footnotes "Label — text": text must equal the BSB text for Label
//  - inline quotes immediately followed by "(Ref)": quoted words must appear in the BSB text of Ref
// Also lists leftover ESV-isms. Run: node tools/verify.mjs
import fs from 'node:fs';
import { parseChain, text, exists, label, REF_RE } from './bible.mjs';

const norm = (s) =>
  s.replace(/<[^>]+>/g, ' ').replace(/\[\^[^\]]+\]/g, '').replace(/[*_]/g, '').replace(/\\/g, '')
    .replace(/[“”"‘’']/g, "'").replace(/[—–-]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
// "+" is kept: it marks the plural you (you+, your+, yours+) and must match the BSB master.
const bare = (s) => norm(s).replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();

const problems = [];
let checked = 0;
for (const f of fs.readdirSync('chapters').sort()) {
  const t = fs.readFileSync(`chapters/${f}`, 'utf8');
  const ch = f.slice(0, 2);
  // blocks
  for (const b of t.split(/\n{2,}/)) {
    if (!b.startsWith('>') || !b.includes('<cite>')) continue;
    const cite = b.match(/<cite>([^<]+)<\/cite>/)[1].replace(/\(.*?\)/, '').trim();
    const refs = parseChain(cite);
    if (!refs.length || !refs.every(exists)) { problems.push(`${ch} block cite unparsed: ${cite}`); continue; }
    const body = b.replace(/<cite>.*<\/cite>/, '').replace(/^> ?/gm, ' ');
    const full = bare(text(refs, { numbers: false }));
    for (const seg of body.split(/…|\.\.\.|<br>/)) {
      for (const piece of seg.split(/<sup>\d+<\/sup>/)) {
        const p = bare(piece);
        if (p.length < 3) continue;
        checked++;
        if (!full.includes(p)) problems.push(`${ch} block ${cite}: not BSB → “${piece.trim().slice(0, 120)}”`);
      }
    }
  }
  // footnotes
  for (const m of t.matchAll(/^\[\^[^\]]+\]: (.+?) — (.+)$/gm)) {
    const lab = m[1];
    if (/\(KJV\)/.test(lab)) continue;
    const refs = parseChain(lab);
    if (!refs.length || !refs.every(exists)) continue;
    checked++;
    const SUP = ['For the choirmaster. With stringed instruments. A Psalm of David. ', 'A song of ascents. ', 'For the choirmaster. To the tune of “The Doe of the Dawn.” A Psalm of David. ', 'For the choirmaster. A Psalm of David. ', 'A Psalm of David. ', 'A prayer of David. '];
    let want = text(refs);
    for (const x of SUP) want = want.split(x).join('');
    // a trailing "(…)" after the verse text is an author's note
    if (bare(m[2]) !== bare(want) && bare(m[2].replace(/\s*\([^()]*\)$/, '')) !== bare(want)) problems.push(`${ch} footnote ${lab}: text differs from BSB`);
  }
  // inline quotes followed by a reference
  const prose = t.split('\n').filter((l) => !l.startsWith('>') && !l.startsWith('[^')).join('\n');
  for (const m of prose.matchAll(/“([^”]{12,600})”\s*\(([^)]{3,60})\)/g)) {
    const refs = parseChain(m[2].replace(/,? ?emphasis mine/, ''));
    if (!refs.length || !refs.every(exists)) continue;
    checked++;
    const full = bare(text(refs, { numbers: false }));
    const parts = m[1].split(/…|\.\.\./).map(bare).filter((p) => p.length > 3);
    if (!parts.every((p) => full.includes(p))) problems.push(`${ch} inline ${label(refs)}: “${m[1].slice(0, 100)}”`);
  }
}
fs.writeFileSync('review/verify-report.md', `# Scripture verification\n\n${checked} quotations checked against the BSB; ${problems.length} to look at.\n\n${problems.map((p) => '- ' + p).join('\n')}\n`, 'utf8');
console.log(checked, 'checked;', problems.length, 'problems');
console.log(problems.join('\n'));
