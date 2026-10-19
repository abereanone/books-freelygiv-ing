import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { getBooks } from "./src/lib/data.js";

// SITE_URL lets a preview deploy build against its own origin. The sitemap is
// built from `site`, so whatever is set here is what ends up in <loc> --
// leave it unset in production so the canonical domain below is used.
const site = process.env.SITE_URL ?? "https://books.freely.giving";

// The hosted Read Online books are plain files in public/, which the sitemap integration
// doesn't see, so list them from each book.yaml.
const readOnlinePages = getBooks()
  .flatMap((book) => book.mediaTypes || [])
  .filter((m) => m.type === "htmlBook" || m.type === "htmlBookEs")
  .flatMap((m) => m.sources || [])
  .map((source) => source.url)
  .filter((url) => url?.startsWith("/"))
  .map((url) => new URL(url, site).href);

export default defineConfig({
  output: "static",
  site,
  // Astro 7 defaults to "jsx", which drops the line break between text and an inline
  // tag ("enjoy<a>x</a>and" renders as "enjoyxand"). true keeps the Astro 6 behaviour.
  compressHTML: true,
  integrations: [sitemap({ customPages: readOnlinePages })],
  // Authors is a filter on /people/, not a page. On Cloudflare public/_redirects answers
  // first with a real 301; this covers `astro dev` and any host without _redirects.
  redirects: {
    "/authors": "/people/?filter=authors",
  },
});
