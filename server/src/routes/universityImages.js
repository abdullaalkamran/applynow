// Real, persistent disk storage for university logos/cover photos — replaces embedding them as
// base64 data: URLs directly in the University row (see schema.prisma's own note on logoUrl/
// coverPhotoUrl), which is what made /api/universities' response ~15MB. Mirrors routes/documents.js's
// "store the file, serve it back over a real URL" pattern, resized and converted to WebP so the
// files stay small regardless of what the admin originally uploaded.
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");
const requireAuth = require("../middleware/requireAuth");
const { requireDataRole } = require("../middleware/access");

const router = express.Router();

const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif)$/i;
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "universities");
const LOGO_DIR = path.join(UPLOAD_ROOT, "logos");
const COVER_DIR = path.join(UPLOAD_ROOT, "covers");
fs.mkdirSync(LOGO_DIR, { recursive: true });
fs.mkdirSync(COVER_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype || "")) return cb(null, true);
    cb(Object.assign(new Error("Only JPEG, PNG, WebP, or GIF images can be uploaded."), { status: 400 }));
  },
});

// logo: square-ish badge, kept small. cover: wide hero banner, needs more width to stay sharp.
const VARIANTS = {
  logo: { dir: LOGO_DIR, publicPrefix: "/uploads/universities/logos", maxWidth: 256 },
  cover: { dir: COVER_DIR, publicPrefix: "/uploads/universities/covers", maxWidth: 1600 },
};

async function saveVariant(kind, buffer) {
  const { dir, publicPrefix, maxWidth } = VARIANTS[kind];
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
  const resized = await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await fs.promises.writeFile(path.join(dir, filename), resized);
  return `${publicPrefix}/${filename}`;
}

// Stateless on purpose — just resizes/converts and returns a URL, no DB write. The admin picks a
// logo/cover before a brand-new university even has an id yet (the form only creates the record
// on final Save), so this can't be scoped to :id the way documents.js's per-student uploads are;
// routes/universities.js's own POST/PATCH are what actually save the returned URL onto the record.
function registerUploadRoute(kind) {
  router.post(`/${kind}`, requireAuth, requireDataRole, upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded." });
      const url = await saveVariant(kind, req.file.buffer);
      res.status(201).json({ url });
    } catch (err) {
      next(err);
    }
  });
}

registerUploadRoute("logo");
registerUploadRoute("cover");

module.exports = router;
