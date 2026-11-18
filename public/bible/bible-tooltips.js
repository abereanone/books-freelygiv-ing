(function () {
  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : "";
  const metaUrl = new URL("bible-tooltips-meta.json", scriptUrl || window.location.href);
  const versesUrl = new URL("bible-tooltips-verses.json", scriptUrl || window.location.href);
  // Headings are titles, not prose: a post called "5 Lessons from Acts 5" should read as a
  // title, not carry a tooltip link in the middle of it. That covers the post title, the
  // card titles in the listings, and any subheading in an article.
  const skipTags = new Set([
    "A", "SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE",
    "H1", "H2", "H3", "H4", "H5", "H6"
  ]);
  const skipClasses = ["entry-title", "post-title", "entry-summary", "excerpt"];
  let metaPromise;
  let versesPromise;
  let referenceRegex;
  let bookMap = {};
  let singleChapterBooks = new Set();

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeLeadingRomanNumeral(value) {
    return value.replace(/^(iii|ii|i)\s+/i, (match) => {
      const numeral = match.trim().toLowerCase();
      if (numeral === "i") return "1 ";
      if (numeral === "ii") return "2 ";
      if (numeral === "iii") return "3 ";
      return match;
    });
  }

  function normalizeBookKey(book) {
    return normalizeLeadingRomanNumeral(String(book || ""))
      .replace(/\./g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function toBookPattern(book) {
    let pattern = escapeRegex(book).replace(/\s+/g, "\\s+");
    pattern = pattern
      .replace(/^1(?=\\s\+)/, "(?:1|i)")
      .replace(/^2(?=\\s\+)/, "(?:2|ii)")
      .replace(/^3(?=\\s\+)/, "(?:3|iii)")
      .replace(/^1(?=[a-z])/, "(?:1|i)")
      .replace(/^2(?=[a-z])/, "(?:2|ii)")
      .replace(/^3(?=[a-z])/, "(?:3|iii)");
    if (/[a-z]$/i.test(book)) pattern += "\\.?";
    return pattern;
  }

  function getMeta() {
    if (!metaPromise) {
      metaPromise = fetch(metaUrl)
        .then((response) => response.json())
        .then((data) => {
          bookMap = data.bookMap || {};
          singleChapterBooks = new Set(data.singleChapterBooks || []);
          const bookPattern = Object.keys(bookMap)
            .sort((a, b) => b.length - a.length)
            .map(toBookPattern)
            .join("|");
          referenceRegex = new RegExp(
            "\\b(" + bookPattern + ")\\s+(\\d+(?::\\d+(?:[-\\u2013\\u2014](?:\\d+:)?\\d+)?(?:\\s*,\\s*(?:\\d+:)?\\d+(?:[-\\u2013\\u2014]\\d+)?)*)?|\\d+(?:[-\\u2013\\u2014]\\d+)?(?:\\s*,\\s*\\d+(?:[-\\u2013\\u2014]\\d+)?)*)\\b",
            "gi"
          );
          return data;
        });
    }
    return metaPromise;
  }

  function getVerses() {
    if (!versesPromise) {
      versesPromise = fetch(versesUrl).then((response) => response.json());
    }
    return versesPromise;
  }

  function normalizeReference(reference) {
    const match = String(reference || "")
      .trim()
      .replace(/\u2013|\u2014/g, "-")
      .match(/^((?:(?:[1-3]|iii|ii|i)\s+)?[a-z.]+(?:\s+[a-z.]+)*)\s+(.+)$/i);
    if (!match) return "";
    const bookCode = bookMap[normalizeBookKey(match[1])];
    if (!bookCode) return "";
    let chapterAndVerse = String(match[2] || "").trim();
    if (singleChapterBooks.has(bookCode) && !chapterAndVerse.includes(":")) {
      chapterAndVerse = "1:" + chapterAndVerse;
    }
    if (/^\d+$/.test(chapterAndVerse) && !singleChapterBooks.has(bookCode)) {
      return "";
    }
    return bookCode + " " + chapterAndVerse.toLowerCase();
  }

  function segmentKeys(bookCode, chapter, segment, data) {
    const qualified = String(segment).trim().match(/^(\d+):(.+)$/);
    if (qualified) {
      return segmentKeys(bookCode, Number(qualified[1]), qualified[2], data);
    }
    // books.freely.giving: a range across chapters, "5:21-6:4" (here "21-6:4" in chapter 5).
    const across = String(segment).trim().match(/^(\d+)-(\d+):(\d+)$/);
    if (across && chapter && data && data.verses) {
      const keys = [];
      let c = chapter;
      let v = Number(across[1]);
      const endC = Number(across[2]);
      const endV = Number(across[3]);
      while (keys.length < 80 && (c < endC || (c === endC && v <= endV))) {
        const key = bookCode + " " + c + ":" + v;
        if (data.verses[key]) {
          keys.push(key);
          v += 1;
        } else if (v > 1) {
          c += 1;
          v = 1;
        } else {
          break;
        }
      }
      return keys;
    }
    const range = String(segment).trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!range || !chapter) return [];
    const start = Number(range[1]);
    const end = Number(range[2] || range[1]);
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    const keys = [];
    for (let verse = low; verse <= high && keys.length < 80; verse += 1) {
      keys.push(bookCode + " " + chapter + ":" + verse);
    }
    return keys;
  }

  function resolveVerseText(reference, data) {
    const normalized = normalizeReference(reference);
    const match = normalized.match(/^([1-3]?[a-z]+)\s+(\d+):(.+)$/);
    if (!match) return "Verse not found.";
    const bookCode = match[1];
    const chapter = Number(match[2]);
    const segments = match[3].split(",").map((part) => part.trim()).filter(Boolean);
    const parts = [];
    const versions = [];
    let lastChapter = String(chapter);
    segments.forEach((segment) => {
      segmentKeys(bookCode, chapter, segment, data).forEach((key) => {
        const entry = data.verses && data.verses[key];
        // An entry is plain text, or { text, version } when the verse is not the BSB reading.
        const verse = entry && typeof entry === "object" ? entry.text : entry;
        if (verse) {
          const version = (entry && entry.version) || data.version || "BSB";
          if (versions.indexOf(version) === -1) versions.push(version);
          // The reference is shown up front, so the first verse gets no number.
          // A new chapter keeps its chapter number ("6:1"), so a range across chapters reads right.
          const keyChapter = key.replace(/^[a-z0-9]+\s+(\d+):.*$/, "$1");
          const number = keyChapter === lastChapter ? key.replace(/^[a-z0-9]+\s+\d+:/, "") : key.replace(/^[a-z0-9]+\s+/, "");
          parts.push(parts.length ? number + " " + verse : verse);
          lastChapter = keyChapter;
        }
      });
    });
    const label = String(reference || "").trim();
    return parts.length
      ? (label ? label + " - " : "") + parts.join(" ") + " (" + versions.join("/") + ")"
      : "Verse not found.";
  }

  function shouldSkip(node) {
    for (let current = node.parentElement; current; current = current.parentElement) {
      if (skipTags.has(current.tagName) || current.classList.contains("bible-ref")) return true;
      if (skipClasses.some((c) => current.classList.contains(c))) return true;
    }
    return false;
  }

  function linkTextNode(node) {
    const text = node.nodeValue;
    if (!text || !referenceRegex.test(text)) {
      referenceRegex.lastIndex = 0;
      return;
    }
    referenceRegex.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let match;
    while ((match = referenceRegex.exec(text))) {
      // books.freely.giving: leave a bare chapter ("Psalm 119", "Romans 8") as plain text;
      // the tooltip shows verses, so it would only say "Verse not found."
      if (!normalizeReference(match[0])) continue;
      if (match.index > cursor) fragment.append(document.createTextNode(text.slice(cursor, match.index)));
      const span = document.createElement("span");
      span.className = "bible-ref";
      span.tabIndex = 0;
      span.dataset.ref = match[0];
      span.textContent = match[0];
      fragment.append(span);
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(fragment, node);
  }

  // Mouse, keyboard and touch, the same way heritagerestored.org does it: a reference opens on hover or
  // focus and pins open on click/tap, Enter or Space; a second tap, a tap anywhere else, or Escape closes it.
  // A touch skips the hover/focus opening: when a hover handler changes the page, iPhones treat the tap as a
  // hover and send no click, so the verse would open unpinned and never close.
  let pinnedRef = null;
  let shownRef = null;
  let lastTouch = 0;
  const touchedRecently = () => Date.now() - lastTouch < 1000;

  function hideRef(element) {
    element.__bibleTooltipActive = false;
    if (element.__bibleTooltip) element.__bibleTooltip.style.display = "none";
    element.setAttribute("aria-expanded", "false");
    if (pinnedRef === element) pinnedRef = null;
    if (shownRef === element) shownRef = null;
  }

  function showRef(element) {
    if (shownRef && shownRef !== element) hideRef(shownRef);
    shownRef = element;
    element.__bibleTooltipActive = true;
    element.setAttribute("aria-expanded", "true");
    ensureTooltip(element);
  }

  function enhanceReference(element) {
    if (element.dataset.bibleTooltipState) return;
    element.dataset.bibleTooltipState = "ready";
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    element.setAttribute("aria-expanded", "false");
    element.addEventListener("pointerdown", (event) => { if (event.pointerType !== "mouse") lastTouch = Date.now(); });
    element.addEventListener("mouseenter", () => { if (!pinnedRef && !touchedRecently()) showRef(element); });
    element.addEventListener("mouseleave", () => { if (pinnedRef !== element) hideRef(element); });
    element.addEventListener("focus", () => { if (!touchedRecently()) showRef(element); });
    element.addEventListener("blur", () => { if (pinnedRef !== element) hideRef(element); });
    element.addEventListener("click", (event) => {
      event.preventDefault();
      if (pinnedRef === element) {
        hideRef(element);
      } else {
        showRef(element);
        pinnedRef = element;
      }
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        element.click();
      } else if (event.key === "Escape") {
        hideRef(element);
        element.blur();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shownRef) hideRef(shownRef);
  });
  // pointerdown rather than click: iPhones send no click for a tap on plain text, so a document-level
  // click listener would never hear the tap that should close the verse.
  document.addEventListener("pointerdown", (event) => {
    if (!shownRef) return;
    const tip = shownRef.__bibleTooltip;
    // A tap on the verse box closes it too (on a phone the box covers the text right below the
    // reference, so that is where "tapping off" lands); only a link inside the box is left to work.
    if (shownRef.contains(event.target)) return;
    if (tip && tip.contains(event.target) && event.target.closest && event.target.closest("a")) return;
    hideRef(shownRef);
  }, true);

  function positionTooltip(anchor, tooltip) {
    const rect = anchor.getBoundingClientRect();
    tooltip.style.visibility = "hidden";
    tooltip.style.display = "block";
    let left = rect.left + window.scrollX;
    const width = tooltip.offsetWidth;
    if (left + width > window.innerWidth - 16) left = window.innerWidth - width - 16;
    if (left < 16) left = 16;
    tooltip.style.left = left + "px";
    tooltip.style.top = rect.bottom + window.scrollY + 8 + "px";
    tooltip.style.visibility = "visible";
    tooltip.style.display = anchor.__bibleTooltipActive ? "block" : "none";
  }

  function ensureTooltip(element) {
    if (element.__bibleTooltip) {
      positionTooltip(element, element.__bibleTooltip);
      return;
    }
    getVerses().then((data) => {
      const tooltip = document.createElement("div");
      tooltip.className = "bible-tooltip";
      tooltip.textContent = resolveVerseText(element.dataset.ref, data);
      document.body.appendChild(tooltip);
      element.__bibleTooltip = tooltip;
      positionTooltip(element, tooltip);
    }).catch(() => {});
  }

  function scanScope(scope) {
    if (scope.dataset.bibleProcessed === "true") return;
    scope.dataset.bibleProcessed = "true";
    // teaching.michaelcoughlin.net: the server already marked the references (spoken forms, full book
    // names only), so do not scan the text for more. "is 2" or "am 3" in speech is not a Bible reference.
    if (scope.dataset.bibleMarked === "true") {
      scope.querySelectorAll(".bible-ref").forEach(enhanceReference);
      return;
    }
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldSkip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(linkTextNode);
    scope.querySelectorAll(".bible-ref").forEach(enhanceReference);
  }

  function init() {
    getMeta().then(() => {
      document
        .querySelectorAll(".post-content, .entry-content, article")
        .forEach(scanScope);
    }).catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
