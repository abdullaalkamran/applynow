const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { sendDocumentNotification } = require("../notifications/dispatch");

const router = express.Router();

// Real, persistent disk storage for uploaded documents — this used to be a browser-generated
// blob: URL (URL.createObjectURL), which only ever resolves inside the tab that created it. That
// worked by accident for the uploader's own immediate view, but was fundamentally broken for
// everyone else: a counsellor opening a student's upload in their own browser/session got a blob:
// URL from a tab that was never theirs, so it 404'd every time — "View" just didn't work. Storing
// the actual file and serving it back over a real URL (see app.js's static /uploads mount) fixes
// that for every viewer, including after a reload, and stays working after approval/rejection too
// since the file itself never moves.
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "documents");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

/** Recipients for a document review event — the student themselves plus their agent (the
 * counsellor doing the reviewing obviously already knows). Same "student, agent" pairing the
 * application-status notifications use, minus the counsellor. */
async function studentAndAgentRecipients(studentId) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return { student: null, recipients: [] };
  const agent = student.agentId ? await prisma.staff.findUnique({ where: { id: student.agentId } }) : null;
  const recipients = [];
  for (const contact of [student, agent].filter(Boolean)) {
    if (contact.phone) recipients.push({ channel: "whatsapp", to: contact.phone });
    if (contact.email) recipients.push({ channel: "email", to: contact.email });
  }
  return { student, recipients };
}

// Currently only the student's core-document vault (scope "core") is migrated here — uploaded
// once, independent of any application, so it needs to be visible identically to the student, and
// to their counsellor and agent (see documentChecklist.ts's buildCoreChecklist). Per-application
// uploads (applicationDocsStore.ts) and ad-hoc counsellor requests (customDocRequestsStore.ts)
// stay localStorage-backed for now, same deferred-migration note as applicationsStore.ts's status
// history — nothing about this route stops them from moving here later too.
function serializeDocument(d) {
  return {
    id: d.id,
    studentId: d.studentId,
    applicationId: d.applicationId || undefined,
    scope: d.scope,
    name: d.name,
    type: d.type,
    status: d.status,
    // Relative — the client prefixes this with its own BACKEND_BASE (dev vs. production point at
    // different hosts, and the served path itself doesn't need to know which).
    fileUrl: d.fileUrl || undefined,
    custom: d.custom,
    rejectionReason: d.rejectionReason || undefined,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { studentId, applicationId, scope } = req.query;
    const where = {};
    if (studentId) where.studentId = String(studentId);
    if (applicationId) where.applicationId = String(applicationId);
    if (scope) where.scope = String(scope);
    const docs = await prisma.document.findMany({ where, orderBy: { createdAt: "asc" } });
    res.json(docs.map(serializeDocument));
  } catch (err) {
    next(err);
  }
});

// A "requested" row is a placeholder slot — the student manually picked a document type to add to
// their checklist (see the "Add a document type" picker, used when their academic profile is too
// incomplete for the type list to auto-derive correctly) without having uploaded anything for it
// yet — sent as plain JSON, no file attached. Every other POST here is a real upload: sent as
// multipart/form-data with the file under the field name "file", alongside the same text fields.
// requireAuth runs before multer, same reasoning as transcribe.js — reject before spending effort
// parsing a (potentially large) body.
router.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    const { studentId, applicationId, scope, name, type, custom, status } = req.body || {};
    if (!studentId || !scope || !name || !type) {
      return res.status(400).json({ error: "studentId, scope, name and type are required." });
    }
    const fileUrl = req.file ? `/uploads/documents/${req.file.filename}` : undefined;
    const doc = await prisma.document.create({
      data: {
        studentId, applicationId, scope, name, type, fileUrl,
        status: status === "requested" ? "requested" : "uploaded",
        custom: !!custom,
      },
    });
    res.status(201).json(serializeDocument(doc));
  } catch (err) {
    next(err);
  }
});

// Verifying (approving/rejecting) an uploaded document is a counsellor-only action — the student
// and agent can both upload and view, but only the counsellor signs off on whether it's acceptable.
// A rejection requires a reason, which the student then sees on the checklist prompting a re-upload.
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (req.authUser.role !== "counsellor") {
      return res.status(403).json({ error: "Only a counsellor can verify a document." });
    }
    const { status, rejectionReason } = req.body || {};
    if (status !== "verified" && status !== "rejected") {
      return res.status(400).json({ error: 'status must be "verified" or "rejected".' });
    }
    if (status === "rejected" && !rejectionReason?.trim()) {
      return res.status(400).json({ error: "rejectionReason is required when rejecting a document." });
    }
    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data: { status, rejectionReason: status === "rejected" ? rejectionReason.trim() : null },
    });

    // WhatsApp/email the student and their agent — a rejection especially needs their attention
    // (it's blocking the application until re-uploaded), but a verification is worth knowing too.
    const { student, recipients } = await studentAndAgentRecipients(doc.studentId);
    if (student && recipients.length > 0) {
      const message =
        status === "rejected"
          ? `Hi ${student.name}, your document "${doc.type}" was rejected: ${doc.rejectionReason}. Please re-upload it as soon as possible.`
          : `Hi ${student.name}, your document "${doc.type}" has been verified.`;
      sendDocumentNotification({ subject: `StudyOne: Document ${status}`, message, recipients }).catch((err) =>
        console.warn("Document review notification failed to send:", err)
      );
    }

    res.json(serializeDocument(doc));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
