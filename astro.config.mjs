import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// SITE_URL lets a preview deploy build against its own origin. The sitemap is
// built from `site`, so whatever is set here is what ends up in <loc> --
// leave it unset in production so the canonical domain below is used.
const site = process.env.SITE_URL ?? "https://books.freelygiv.ing";

export default defineConfig({
  output: "static",
  site,
  integrations: [sitemap()],
});
