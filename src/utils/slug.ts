/** Readable URL name, the same rule as server/src/slugs.js: "South Korea" -> "south-korea" ("Zürich" -> "zurich"). */
export function slugify(text: string, fallback = "item"): string {
  const s = String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}
