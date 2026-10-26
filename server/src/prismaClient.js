// Singleton Prisma client — guards against duplicate connections when `node --watch` (this repo's
// dev script) or Passenger reloads the module without restarting the process.
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const { PrismaClient } = require("@prisma/client");

// Shared hosting + a remote MySQL means a handful of sequential queries can easily take longer than
// Prisma's defaults (5s per interactive transaction, 2s to get one started, 10s to get a pooled
// connection) — which surfaced as "timeout" errors on exactly the multi-step writes a counsellor
// does all day (change a status, post a comment, request/reject a document, add a task). Give
// them realistic headroom instead of failing a write that would have succeeded a second later.
function withPoolTimeout(url) {
  if (!url || /[?&]pool_timeout=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}pool_timeout=30`;
}

const prisma =
  global.__prisma ||
  new PrismaClient({
    datasourceUrl: withPoolTimeout(process.env.DATABASE_URL),
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  });
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;

module.exports = prisma;
