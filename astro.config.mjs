import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// SITE_URL lets a preview deploy build against its own origin. The sitemap is
// built from `site`, so whatever is set here is what ends up in <loc> --
// leave it unset in production so the canonical domain below is used.
const site = process.env.SITE_URL ?? "https://books.freely.giving";

export default defineConfig({
  output: "static",
  site,
  integrations: [sitemap()],
  // Authors is a filter on /people/, not a page. On Cloudflare public/_redirects answers
  // first with a real 301; this covers `astro dev` and any host without _redirects.
  redirects: {
    "/authors": "/people/?filter=authors",
  },
});
