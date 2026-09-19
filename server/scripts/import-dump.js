// Restores a `pg_dump --data-only --column-inserts` file into the database in DATABASE_URL
// without needing psql on this machine (the portable Postgres build has none). Strips psql
// meta-commands (\restrict, \connect, …) that pg_dump emits and disables FK/trigger checks for
// the session so insert order doesn't matter. Run against an EMPTY schema:
//   npx prisma migrate reset --force --skip-seed
//   node scripts/import-dump.js ../studyone-data.sql
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/import-dump.js <dump.sql>");
  process.exit(1);
}

const serverDir = path.join(__dirname, "..");
let sql = fs.readFileSync(src, "utf8").replace(/^﻿/, "");
sql = sql
  .split(/\r?\n/)
  .filter((line) => !line.startsWith("\\"))
  .join("\n");
sql = "SET session_replication_role = replica;\n" + sql;

const tmp = path.join(serverDir, ".import.tmp.sql");
fs.writeFileSync(tmp, sql);
try {
  execFileSync("npx", ["prisma", "db", "execute", "--file", tmp, "--schema", "prisma/schema.prisma"], {
    stdio: "inherit",
    cwd: serverDir,
    shell: true,
  });
  console.log("Import finished.");
} finally {
  fs.unlinkSync(tmp);
}
