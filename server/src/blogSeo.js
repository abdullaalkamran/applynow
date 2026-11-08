// What the News editor's save step works out on its own: a clean readable slug, and the FAQ found in the post's Markdown text.
const { slugify } = require("./slugs");

const STOP = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "what", "how", "is", "are", "your", "with", "does", "do", "will", "can", "it", "its", "this", "that"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 70;

/** "Canada Study Permit Cap 2027: What the New Plan Means" -> "canada-study-permit-cap-2027-new-plan-means": keyword words only, at most 8, no hash. */
function makeSlug(title) {
  const words = slugify(title, "post").split("-").filter(Boolean);
  const kept = words.filter((w) => !STOP.has(w));
  let s = (kept.length >= 2 ? kept : words).slice(0, 8).join("-");
  if (s.length > MAX_SLUG) s = s.slice(0, MAX_SLUG).replace(/-[^-]*$/, "") || s.slice(0, MAX_SLUG);
  return s || "post";
}

const isValidSlug = (s) => typeof s === "string" && s.length <= 80 && SLUG_RE.test(s);

/** `base`, else `base-2`, `base-3`… — first one `isTaken` doesn't claim. */
function uniqueSlug(base, isTaken) {
  if (!isTaken(base)) return base;
  for (let n = 2; ; n++) if (!isTaken(`${base}-${n}`)) return `${base}-${n}`;
}

const stripMd = (t) => String(t || "")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`>#]+/g, "").replace(/\s+/g, " ").trim();

/** Question/answer pairs from a "Frequently asked questions" (or "FAQ") section: each question is a deeper heading or a bold line
 * ending in "?", its answer the text below it. Returns [] when there is no such section. */
function detectFaq(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const heading = (l) => /^(#{1,6})\s+(.*)$/.exec(l.trim());
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = heading(lines[i]);
    if (m && m[1].length <= 3 && /frequently asked|\bfaqs?\b/i.test(m[2])) { start = i + 1; level = m[1].length; break; }
  }
  if (start < 0) return [];
  const out = [];
  let q = null;
  let a = [];
  const flush = () => {
    const answer = stripMd(a.join(" "));
    if (q && answer) out.push({ q: q.slice(0, 300), a: answer.slice(0, 1000) });
    q = null; a = [];
  };
  for (let i = start; i < lines.length && out.length < 20; i++) {
    const line = lines[i].trim();
    const h = heading(line);
    if (h && h[1].length <= level) break; // the next section
    const bold = /^\*\*(.+?\?)\*\*\s*$/.exec(line);
    if (h) { flush(); const text = stripMd(h[2]); if (text) q = text; }
    else if (bold) { flush(); q = stripMd(bold[1]); }
    else if (line && q) a.push(line);
  }
  flush();
  return out;
}

module.exports = { makeSlug, isValidSlug, uniqueSlug, detectFaq, stripMd };
