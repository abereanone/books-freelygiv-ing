const __dirname = import.meta.dirname;
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import YAML from "yaml";

export default async function(eleventyConfig) {
	eleventyConfig.addPassthroughCopy({"static/css": "css"});
	eleventyConfig.addPassthroughCopy({"static/js": "js"});
	eleventyConfig.addPassthroughCopy("static/images");
	eleventyConfig.addPassthroughCopy("static/books", "books");
	eleventyConfig.addPassthroughCopy({"static/favico/*": "/"});

  eleventyConfig.addFilter("toUTCString", async function(value) {
    return value.toUTCString();
  });
  eleventyConfig.addFilter("authorNames", function(authors) {
    if (!authors || authors.length === 0) return "";
    return authors.map(a => `${a.firstName} ${a.lastName}`).join(", ");
  });
  eleventyConfig.addFilter("linkify", function(text) {
    if (!text) return text;
    return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  });
  eleventyConfig.addFilter("sortByAuthor", function(books) {
    return [...books]
      .filter(b => b.authors && b.authors.length > 0)
      .sort((a, b) => {
        const aName = a.authors[0].lastName.toLowerCase();
        const bName = b.authors[0].lastName.toLowerCase();
        return aName.localeCompare(bName);
      });
  });
  eleventyConfig.addDataExtension("yml,yaml", (contents) => YAML.parse(contents));

  const srcDir = './library/data/src';

  const imageExts = new Set(['.webp', '.jpg', '.jpeg', '.png']);

  for (const authorSlug of readdirSync(srcDir)) {
    const authorDir = join(srcDir, authorSlug);

    // Copy data/src/<slug>/<image> → _site/static/images/authors/<slug>/<image>
    //                              or _site/static/images/contributors/<slug>/<image>
    const isAuthor = existsSync(join(authorDir, 'author.yaml'));
    const imageFolder = isAuthor ? 'authors' : 'contributors';
    for (const file of readdirSync(authorDir).filter(f => imageExts.has(extname(f).toLowerCase()) && statSync(join(authorDir, f)).isFile())) {
      eleventyConfig.addPassthroughCopy({
        [join(authorDir, file)]: `static/images/${imageFolder}/${authorSlug}/${file}`
      });
    }

    // Copy data/src/<author>/<book>/content/ → _site/static/books/<author>/<book>/
    for (const bookSlug of readdirSync(authorDir).filter(e => statSync(join(authorDir, e)).isDirectory())) {
      const contentDir = join(authorDir, bookSlug, 'content');
      if (existsSync(contentDir)) {
        eleventyConfig.addPassthroughCopy({
          [contentDir]: `static/books/${authorSlug}/${bookSlug}`
        });
      }
    }
  }

  eleventyConfig.addGlobalData("authors", () => {
    return readdirSync(srcDir).flatMap(authorSlug => {
      const authorFile = join(srcDir, authorSlug, 'author.yaml');
      return existsSync(authorFile) ? YAML.parse(readFileSync(authorFile, 'utf8')) : [];
    });
  });
  eleventyConfig.addGlobalData("contributors", () => {
    return readdirSync(srcDir).flatMap(authorSlug => {
      const contributorFile = join(srcDir, authorSlug, 'contributor.yaml');
      return existsSync(contributorFile) ? YAML.parse(readFileSync(contributorFile, 'utf8')) : [];
    });
  });
  eleventyConfig.addGlobalData("books", () => {
    return readdirSync(srcDir).flatMap(authorSlug => {
      const authorDir = join(srcDir, authorSlug);
      return readdirSync(authorDir)
        .filter(entry => statSync(join(authorDir, entry)).isDirectory())
        .flatMap(bookSlug => {
          return YAML.parse(readFileSync(join(authorDir, bookSlug, 'book.yaml'), 'utf8'));
        });
    });
  });
};

export const config = {
  dir: {
    input: "pages"
  }
};
