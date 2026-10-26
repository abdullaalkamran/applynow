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
const MAX_AGE_MS = 10 * 60 * 1000; // safety net for any write path that forgets to call invalidateCatalog()

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

async function getCatalog(serializeUniversity) {
  const current = built && built.version === version;
  if (current && Date.now() - built.at < MAX_AGE_MS) return built;
  // Only aged out (nothing was written): keep serving the copy we have and refresh it behind the scenes, so no request
  // ever waits on a rebuild. After a real write (version moved on) the next request does wait, so it sees the change.
  if (current) {
    startBuild(serializeUniversity).catch((err) => console.warn("Background catalog refresh failed:", err));
    return built;
  }
  return startBuild(serializeUniversity);
}

module.exports = { getCatalog, invalidateCatalog };
