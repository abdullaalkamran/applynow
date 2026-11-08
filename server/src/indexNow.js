// Tells Bing (which also feeds ChatGPT search and Copilot) and other IndexNow engines that pages were added or changed, so they
// re-crawl them within minutes instead of days. Needs INDEXNOW_KEY in the environment (any 8-128 letters/digits/dashes); with no key
// it does nothing. It is called without waiting and never throws — a failed ping must never get in the way of saving a post.
const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

const key = () => {
  const k = (process.env.INDEXNOW_KEY || "").trim();
  return KEY_RE.test(k) ? k : "";
};

function pingIndexNow(paths, siteUrl) {
  const k = key();
  if (!k || !paths.length) return;
  const host = new URL(siteUrl).host;
  fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: k, keyLocation: `${siteUrl}/${k}.txt`, urlList: [...new Set(paths)].map((p) => `${siteUrl}${p}`) }),
  }).then((r) => console.log(`[IndexNow] ${r.status} for ${paths.length} URL(s)`)).catch((err) => console.warn("[IndexNow] failed:", err.message));
}

module.exports = { pingIndexNow, indexNowKey: key };
