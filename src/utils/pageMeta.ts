// Keeps the browser tab title, the meta description and the canonical link right while a visitor moves between public pages
// WITHOUT a full page load. (On a first visit or for a crawler the server already renders the right head — see server/src/seo.js;
// this only covers client-side navigation, where the head would otherwise keep the previous page's text.)
import siteMeta from "../data/siteMeta.json";

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}

const clamp = (text: string, max: number) => {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const sentence = t.slice(0, max).search(/[.!?](?=[^.!?]*$)/);
  if (sentence >= max * 0.6) return t.slice(0, sentence + 1);
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
};

/** Sets this page's title/description/canonical; returns a function that puts the site defaults back. */
export function setPageMeta(title: string, description: string, path = window.location.pathname): () => void {
  document.title = title.length > 65 ? title.replace(/\s+[—-]\s+UnifinderAi$/, "") : title;
  const desc = clamp(description, 160);
  setMeta('meta[name="description"]', () => Object.assign(document.createElement("meta"), { name: "description" }), "content", desc);
  setMeta('meta[property="og:title"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:title"); return m; }, "content", document.title);
  setMeta('meta[property="og:description"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:description"); return m; }, "content", desc);
  setMeta('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", `${window.location.origin}${path}`);
  return () => {
    document.title = siteMeta.title;
    document.head.querySelector('meta[name="description"]')?.setAttribute("content", siteMeta.description);
    document.head.querySelector('meta[property="og:title"]')?.setAttribute("content", siteMeta.title);
    document.head.querySelector('meta[property="og:description"]')?.setAttribute("content", siteMeta.description);
    document.head.querySelector('link[rel="canonical"]')?.setAttribute("href", `${window.location.origin}/`);
  };
}
