// The partner catalog (GET /api/universities) is every university with every one of its courses — on a real deployment
// that is ~17,000 courses and ~33 MB of JSON. Building it the naive way (one query for everything, serialise it all, then
// JSON.stringify one giant string) needs several hundred MB of RAM per request; on shared hosting that is enough to get the
// app killed, which shows up as 503 "server busy" and endless loading.
//
// This builds the SAME JSON array, but:
//   - reads the universities a few at a time and gzips each one as it is produced, so memory stays small and flat;
//   - keeps the finished (gzipped, ~1–4 MB) result and serves it to everyone until a university/course is written — a page
//     load then costs no database work at all, and a browser reload gets a 304 from the ETag;
//   - lets simultaneous first requests share one build instead of each starting their own.
// The response format is byte-for-byte what res.json(universities.map(serializeUniversity)) produced.
const zlib = require("zlib");
const crypto = require("crypto");
const prisma = require("./prismaClient");

// Universities per database round trip (each carries all its courses). One at a time meant one round trip per university —
// hundreds of sequential queries holding connections from the shared pool while a counsellor's own requests waited behind them.
const PAGE_SIZE = 5;
// Safety net for any write path that forgets to call invalidateCatalog(). Rebuilding is heavy (the whole catalogue is re-read,
// serialised and gzipped), so it is rare: writes already invalidate immediately.
const MAX_AGE_MS = 60 * 60 * 1000;

let version = 0;
let built = null; // { version, at, etag, gzip }
let inflight = null;

/** Call after anything that creates, changes or deletes a university or course. */
function invalidateCatalog() {
  version += 1;
}

async function buildCatalog(serializeUniversity) {
  const startedAt = version;
  const gz = zlib.createGzip({ level: 6 });
  const chunks = [];
  gz.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => { gz.on("end", resolve); gz.on("error", reject); });

  const hash = crypto.createHash("sha1");
  const write = (text) => { hash.update(text); return gz.write(text); };
  write("[");
  let first = true;
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await prisma.university.findMany({
      include: { courses: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip,
      take: PAGE_SIZE,
    });
    for (const u of page) {
      const ok = write((first ? "" : ",") + JSON.stringify(serializeUniversity(u)));
      first = false;
      if (!ok) await new Promise((r) => gz.once("drain", r)); // let the compressor catch up instead of buffering
    }
    if (page.length < PAGE_SIZE) break;
  }
  write("]");
  gz.end();
  await done;
  const gzip = Buffer.concat(chunks);
  return { version: startedAt, at: Date.now(), etag: `"cat-${hash.digest("hex").slice(0, 20)}"`, gzip };
}

function startBuild(serializeUniversity) {
  if (!inflight) {
    inflight = buildCatalog(serializeUniversity)
      .then((entry) => { built = entry; return entry; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

// After a write the previous copy is still served for up to this long while a fresh one builds in the background. A bulk
// edit (dozens of PATCHes in a row) used to make every list request wait for a full ~30 MB rebuild — minutes of "loading",
// and pile-ups of builds holding database connections. The writer's own browser already applies its change locally, and
// everyone else catches up on their next poll once the rebuild lands.
const MAX_STALE_MS = 3 * 60 * 1000;
const REBUILD_DEBOUNCE_MS = 4000; // coalesce a burst of writes into one rebuild
let rebuildTimer = null;

function scheduleRebuild(serializeUniversity) {
  if (rebuildTimer || inflight) return;
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    startBuild(serializeUniversity).catch((err) => console.warn("Background catalog rebuild failed:", err));
  }, REBUILD_DEBOUNCE_MS);
  if (rebuildTimer.unref) rebuildTimer.unref();
}

async function getCatalog(serializeUniversity) {
  if (built) {
    const current = built.version === version;
    const age = Date.now() - built.at;
    if (current && age < MAX_AGE_MS) return built;
    if (current || age < MAX_STALE_MS) {
      // Serve what we have now; refresh behind the scenes.
      if (current) startBuild(serializeUniversity).catch((err) => console.warn("Background catalog refresh failed:", err));
      else scheduleRebuild(serializeUniversity);
      return built;
    }
  }
  return startBuild(serializeUniversity);
}

/** Builds the catalog ahead of the first request (call once at server start). */
function warmCatalog(serializeUniversity) {
  startBuild(serializeUniversity).catch((err) => console.warn("Catalog warm-up failed:", err));
}

const catalogVersion = () => version;

module.exports = { getCatalog, invalidateCatalog, warmCatalog, catalogVersion };
