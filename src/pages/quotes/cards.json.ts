// /quotes/cards.json: every public card (id, thumbnail in its own look, alt text), for the
// endless "More quote cards" feed on quote pages.
import { getQuotes, quoteImage } from '../../lib/data.js';

export function GET() {
  const cards = getQuotes().map((q: any) => ({ id: q.id, img: quoteImage(q.id, q.tone, 'thumb'), alt: `${q.text} (${q.authorName})` }));
  return new Response(JSON.stringify(cards), { headers: { 'Content-Type': 'application/json' } });
}
