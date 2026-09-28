// One-off backfill: moves university logos/cover photos out of the database (where they were
// embedded as base64 data: URLs — see routes/universityImages.js's own comment on why that made
// /api/universities' response ~15MB) into real files served from /uploads/universities/.
//
// Run from the server/ directory, on the machine that will actually serve the resulting files
// (production) and that has DATABASE_URL pointing at the real database:
//
//   node scripts/migrate-images.js --dir /path/to/extracted/images [--dry-run]
//
// --dir points at the extracted contents of unifinder-backup-2026-09-28.zip's images/ folder
// (expects manifest.csv, logos/, covers/ inside it — matching the zip's own layout). Always run
// with --dry-run first and read its output before running for real.
//
// Idempotent and safe to re-run: a university row is only ever touched if its current logoUrl/
// coverPhotoUrl still starts with "data:" — anything already migrated (or manually set to a real
// URL) is left alone. Backs up the whole University table to a timestamped JSON file before making
// any real change (skipped in --dry-run, since nothing is being changed).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const prisma = require("../src/prismaClient");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirFlagIndex = args.indexOf("--dir");
const imagesDir = dirFlagIndex >= 0 ? args[dirFlagIndex + 1] : null;

if (!imagesDir) {
  console.error("Usage: node scripts/migrate-images.js --dir /path/to/extracted/images [--dry-run]");
  process.exit(1);
}

const MANIFEST_PATH = path.join(imagesDir, "manifest.csv");
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "universities");
const BACKUP_DIR = path.join(__dirname, "backups");

const VARIANTS = {
  logo: { sourceDir: path.join(imagesDir, "logos"), destDir: path.join(UPLOAD_ROOT, "logos"), publicPrefix: "/uploads/universities/logos", maxWidth: 256, dbField: "logoUrl" },
  cover: { sourceDir: path.join(imagesDir, "covers"), destDir: path.join(UPLOAD_ROOT, "covers"), publicPrefix: "/uploads/universities/covers", maxWidth: 1600, dbField: "coverPhotoUrl" },
};

// Normalizes the manifest's "field" column — accepts logo/logoUrl/cover/coverPhotoUrl so a manifest
// generated slightly differently than expected still works instead of silently skipping every row.
function normalizeField(raw) {
  const f = raw.trim().toLowerCase();
  if (f.includes("logo")) return "logo";
  if (f.includes("cover")) return "cover";
  return null;
}

// Minimal quoted-CSV-field parser — a plain split(",") breaks the moment a university_name
// contains a comma (e.g. "University of X, Y Campus"), which real institution names do.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function readManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  const rows = parseCsv(raw);
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idxOf = (name) => header.indexOf(name);
  const cols = { id: idxOf("university_id"), name: idxOf("university_name"), field: idxOf("field"), file: idxOf("file_name") };
  if (Object.values(cols).some((i) => i === -1)) {
    throw new Error(`manifest.csv header must have university_id, university_name, field, file_name — got: ${header.join(", ")}`);
  }
  return rows.slice(1).map((r) => ({
    universityId: r[cols.id]?.trim(),
    universityName: r[cols.name]?.trim(),
    field: normalizeField(r[cols.field] || ""),
    fileName: r[cols.file]?.trim(),
  }));
}

async function toWebp(buffer, maxWidth) {
  return sharp(buffer).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}

async function backupUniversityTable() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const rows = await prisma.university.findMany({ include: { courses: true } });
  const file = path.join(BACKUP_DIR, `university-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  console.log(`Backed up ${rows.length} university rows to ${file}`);
  return file;
}

async function main() {
  const manifest = readManifest();
  console.log(`Read ${manifest.length} row(s) from ${MANIFEST_PATH}${dryRun ? " (DRY RUN — nothing will be written)" : ""}`);

  for (const dir of [VARIANTS.logo.destDir, VARIANTS.cover.destDir]) fs.mkdirSync(dir, { recursive: true });
  if (!dryRun) await backupUniversityTable();

  const summary = { migrated: 0, skippedAlreadyReal: 0, skippedNoDataUrl: 0, missingEverywhere: 0, failed: 0, unknownField: 0 };

  for (const row of manifest) {
    const label = `${row.universityName || row.universityId} (${row.field ?? "?"})`;
    if (!row.field) {
      console.warn(`SKIP  ${label}: unrecognized field column value`);
      summary.unknownField++;
      continue;
    }
    const variant = VARIANTS[row.field];

    try {
      const university = await prisma.university.findUnique({ where: { id: row.universityId } });
      if (!university) {
        console.warn(`SKIP  ${label}: no University row with id "${row.universityId}"`);
        summary.failed++;
        continue;
      }

      const currentValue = university[variant.dbField];
      if (typeof currentValue !== "string" || !currentValue.startsWith("data:")) {
        console.log(`SKIP  ${label}: ${variant.dbField} is already a real URL (or empty) — nothing to migrate`);
        summary.skippedAlreadyReal++;
        continue;
      }

      // Prefer the actual file from the backup zip (original quality); fall back to decoding the
      // base64 payload already sitting in the DB row if the manifest points at a file that isn't
      // there — covers a manifest generated slightly out of sync with the zip's actual contents.
      let sourceBuffer;
      const filePath = row.fileName ? path.join(variant.sourceDir, row.fileName) : null;
      if (filePath && fs.existsSync(filePath)) {
        sourceBuffer = fs.readFileSync(filePath);
      } else {
        const match = currentValue.match(/^data:[^;]+;base64,(.+)$/);
        if (!match) {
          console.warn(`FAIL  ${label}: file missing from zip (${filePath || "no file_name"}) and DB value isn't a decodable base64 data: URL`);
          summary.missingEverywhere++;
          continue;
        }
        console.log(`      ${label}: file missing from zip, falling back to the base64 already in the DB row`);
        sourceBuffer = Buffer.from(match[1], "base64");
      }

      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
      const publicUrl = `${variant.publicPrefix}/${filename}`;

      if (dryRun) {
        console.log(`WOULD MIGRATE  ${label}: -> ${publicUrl} (source ${(sourceBuffer.length / 1024).toFixed(0)}KB)`);
        summary.migrated++;
        continue;
      }

      const webp = await toWebp(sourceBuffer, variant.maxWidth);
      fs.writeFileSync(path.join(variant.destDir, filename), webp);
      await prisma.university.update({ where: { id: row.universityId }, data: { [variant.dbField]: publicUrl } });
      console.log(`OK    ${label}: -> ${publicUrl} (${(webp.length / 1024).toFixed(0)}KB)`);
      summary.migrated++;
    } catch (err) {
      console.error(`FAIL  ${label}:`, err.message);
      summary.failed++;
    }
  }

  console.log("\nSummary:", summary);
  if (dryRun) console.log("\nDry run only — re-run without --dry-run to actually migrate.");
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
