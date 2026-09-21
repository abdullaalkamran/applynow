// Links built from data people typed in (country guide links, import source URLs, university
// websites) must never end up as `javascript:` / `data:` URLs that run in this app's origin when
// clicked. Anything that isn't a plain web link is dropped (the anchor renders without an href).

/** `url` if it is an http(s) link, else undefined. */
export function safeHref(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

/** For the document viewer: uploaded files (served from the API) plus in-memory previews. */
export function safeFileHref(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("blob:")) return trimmed;
  if (/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i.test(trimmed)) return trimmed;
  return undefined;
}

/** A university's `website` field as a real URL — stored values range from "ox.ac.uk" to
 * "https://www.ox.ac.uk", and blindly prefixing "https://www." breaks the latter. */
export function websiteHref(website: string | undefined | null): string | undefined {
  if (!website) return undefined;
  const trimmed = website.trim().replace(/^www\./i, "");
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return safeHref(trimmed);
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) return `https://www.${trimmed}`;
  return undefined;
}
