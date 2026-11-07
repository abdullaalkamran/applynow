// Readable URL names: "University of Leeds" -> "university-of-leeds", "MSc Data Science" -> "msc-data-science".
// Slugs are worked out from the names (no database column): the search index assigns them in catalogue order, so a name that
// is already taken gets a place or a number added ("…-leeds", "…-2"), and an existing university keeps its address when a new
// one with the same name is added later. The old id-style addresses keep working (they redirect to the readable one).

const MAX_LENGTH = 80;

/** Lower-case ASCII words joined by hyphens; accents are folded ("Zürich" -> "zurich"). Never empty. */
function slugify(text, fallback = "item") {
  let s = String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > MAX_LENGTH) {
    const cut = s.slice(0, MAX_LENGTH);
    const at = cut.lastIndexOf("-");
    s = (at > MAX_LENGTH * 0.6 ? cut.slice(0, at) : cut).replace(/-+$/, "");
  }
  return s || fallback;
}

/** Hands out slugs that are unique within one set. `claim(base, alternative)` returns `base`, else `base-alternative`, else
 * `base-2`, `base-3`, … */
function slugClaimer() {
  const taken = new Set();
  return function claim(base, alternative = "") {
    const candidates = [base];
    const alt = alternative ? slugify(alternative, "") : "";
    if (alt && !base.endsWith(`-${alt}`)) candidates.push(`${base}-${alt}`.slice(0, MAX_LENGTH + 20));
    for (const c of candidates) if (!taken.has(c)) { taken.add(c); return c; }
    for (let n = 2; ; n++) {
      const c = `${candidates[candidates.length - 1]}-${n}`;
      if (!taken.has(c)) { taken.add(c); return c; }
    }
  };
}

module.exports = { slugify, slugClaimer };
