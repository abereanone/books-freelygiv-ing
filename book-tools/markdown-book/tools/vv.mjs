// print BSB verses: node tools/vv.mjs "Psalm 119:9-12; Eph 5:15-17"
import { parseChain, label, text } from './bible.mjs';
for (const part of process.argv.slice(2).join(' ').split('|')) { const r = parseChain(part.trim()); console.log(label(r) + ': ' + text(r)); }
