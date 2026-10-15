// Counsellor-facing side of the external-portal automation: manage portal logins (write-only credentials), queue a
// submission, and give the second approval that releases the worker's final click. The browser automation itself
// runs in portal-worker/ and talks to routes/worker.js — nothing here drives a portal.
const fs = require("fs");
const path = require("path");
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { requireRoles, accessibleApplication } = require("../middleware/access");
const { encrypt, isConfigured } = require("../secretBox");

const router = express.Router();
const SHOTS_DIR = path.join(__dirname, "..", "..", "data", "portal-shots");
const requireCounsellor = requireRoles("counsellor", "admin");

const KINDS = ["b2b", "university"];

function publicConnection(c) {
  return { id: c.id, name: c.name, url: c.url, kind: c.kind, universityId: c.universityId || undefined, lastLoginOk: c.lastLoginOk ?? undefined, lastLoginAt: c.lastLoginAt?.toISOString(), createdAt: c.createdAt.toISOString() };
}
function publicSubmission(s) {
  return {
    id: s.id, applicationId: s.applicationId, portalConnectionId: s.portalConnectionId, status: s.status, externalRef: s.externalRef || undefined,
    submittedAt: s.submittedAt?.toISOString(), lastCheckedAt: s.lastCheckedAt?.toISOString(), lastError: s.lastError || undefined,
    portalStatus: s.snapshot?.portalStatus, updatedAt: s.updatedAt.toISOString(),
  };
}
const audit = (req, action, extra = {}) =>
  prisma.portalAuditLog.create({ data: { actorType: "counsellor", actorId: req.authUser.roleUserId, action, ...extra } }).catch(() => undefined);

function validUrl(u) {
  try { const x = new URL(String(u)); return x.protocol === "https:" || x.protocol === "http:" ? x.toString() : null; } catch { return null; }
}

// A counsellor only ever sees/uses their own connections (admin: all).
async function ownedConnection(req, id) {
  const c = await prisma.portalConnection.findUnique({ where: { id: String(id) } });
  if (!c) return null;
  return req.authUser.role === "admin" || c.counsellorId === req.authUser.roleUserId ? c : null;
}

router.get("/", requireAuth, requireCounsellor, async (req, res, next) => {
  try {
    const where = req.authUser.role === "admin" ? {} : { counsellorId: req.authUser.roleUserId };
    res.json((await prisma.portalConnection.findMany({ where, orderBy: { createdAt: "desc" } })).map(publicConnection));
  } catch (err) { next(err); }
});

router.post("/", requireAuth, requireCounsellor, async (req, res, next) => {
  try {
    if (!isConfigured()) return res.status(503).json({ error: "Portal credential storage isn't configured on the server (PORTAL_CRED_KEY)." });
    const { name, url, kind, universityId, username, password } = req.body || {};
    const cleanUrl = validUrl(url);
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name is required." });
    if (!cleanUrl) return res.status(400).json({ error: "A valid http(s) portal URL is required." });
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'kind must be "b2b" or "university".' });
    if (typeof username !== "string" || !username || typeof password !== "string" || !password) return res.status(400).json({ error: "username and password are required." });
    const row = await prisma.portalConnection.create({
      data: { counsellorId: req.authUser.roleUserId, name: name.trim().slice(0, 191), url: cleanUrl, kind, universityId: universityId || null, usernameEnc: encrypt(username), passwordEnc: encrypt(password) },
    });
    await audit(req, "connection_created", { portalConnectionId: row.id });
    res.status(201).json(publicConnection(row));
  } catch (err) { next(err); }
});

router.patch("/:id", requireAuth, requireCounsellor, async (req, res, next) => {
  try {
    const c = await ownedConnection(req, req.params.id);
    if (!c) return res.status(404).json({ error: "Portal not found." });
    const { name, url, username, password } = req.body || {};
    const data = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim().slice(0, 191);
    if (url !== undefined) { const u = validUrl(url); if (!u) return res.status(400).json({ error: "A valid http(s) portal URL is required." }); data.url = u; }
    if (typeof username === "string" && username) data.usernameEnc = encrypt(username);
    if (typeof password === "string" && password) { data.passwordEnc = encrypt(password); data.failedLogins = 0; }
    const row = await prisma.portalConnection.update({ where: { id: c.id }, data });
    await audit(req, "connection_updated", { portalConnectionId: c.id });
    res.json(publicConnection(row));
  } catch (err) { next(err); }
});

router.delete("/:id", requireAuth, requireCounsellor, async (req, res, next) => {
  try {
    const c = await ownedConnection(req, req.params.id);
    if (!c) return res.status(404).json({ error: "Portal not found." });
    await prisma.portalConnection.delete({ where: { id: c.id } });
    await audit(req, "connection_deleted", { portalConnectionId: c.id });
    res.status(204).end();
  } catch (err) { next(err); }
});

// Submissions for an application (or all of the caller's, when no applicationId is given).
router.get("/submissions", requireAuth, requireCounsellor, async (req, res, next) => {
  try {
    const conns = await prisma.portalConnection.findMany({ where: req.authUser.role === "admin" ? {} : { counsellorId: req.authUser.roleUserId }, select: { id: true } });
    const where = { portalConnectionId: { in: conns.map((c) => c.id) }, ...(req.query.applicationId ? { applicationId: String(req.query.applicationId) } : {}) };
    res.json((await prisma.portalSubmission.findMany({ where, orderBy: { updatedAt: "desc" }, take: 100 })).map(publicSubmission));
  } catch (err) { next(err); }
});

// Queue a submission: the worker fills the portal but stops before the final click (see PortalJob).
router.post("/:id/submissions", requireAuth, requireCounsellor, async (req, res, next) => {
  try {
    const c = await ownedConnection(req, req.params.id);
    if (!c) return res.status(404).json({ error: "Portal not found." });
    const app = await accessibleApplication(req.authUser, req.body?.applicationId);
    if (!app) return res.status(404).json({ error: "Application not found." });
    const existing = await prisma.portalSubmission.findUnique({ where: { applicationId_portalConnectionId: { applicationId: app.id, portalConnectionId: c.id } } });
    if (existing && ["queued", "preparing", "awaiting_confirm", "submitted"].includes(existing.status)) {
      return res.status(409).json({ error: `This application is already ${existing.status.replace("_", " ")} on that portal.` });
    }
    const submission = existing
      ? await prisma.portalSubmission.update({ where: { id: existing.id }, data: { status: "queued", lastError: null } })
      : await prisma.portalSubmission.create({ data: { applicationId: app.id, portalConnectionId: c.id } });
    await prisma.portalJob.create({ data: { submissionId: submission.id, kind: "submit" } });
    await audit(req, "submission_queued", { portalConnectionId: c.id, applicationId: app.id });
    res.status(201).json(publicSubmission(submission));
  } catch (err) { next(err); }
});

// The second approval: the worker has filled the portal and is waiting at the final submit button.
router.post("/submissions/:id/confirm", requireAuth, requireCounsellor, async (req, res, next) => {
  try {
    const s = await prisma.portalSubmission.findUnique({ where: { id: req.params.id } });
    const c = s && (await ownedConnection(req, s.portalConnectionId));
    if (!s || !c) return res.status(404).json({ error: "Submission not found." });
    if (s.status !== "awaiting_confirm") return res.status(409).json({ error: "This submission isn't waiting for confirmation." });
    await prisma.portalJob.create({ data: { submissionId: s.id, kind: "confirm_submit" } });
    await prisma.portalSubmission.update({ where: { id: s.id }, data: { status: "preparing" } });
    await audit(req, "submission_confirmed", { portalConnectionId: c.id, applicationId: s.applicationId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Latest preview screenshot for a submission awaiting confirmation (the counsellor sees what will be sent). Kept in
// server/data/portal-shots (not the public /uploads mount) and served only to the owning counsellor — it can show
// a student's personal details.
router.get("/submissions/:id/preview", requireAuth, requireCounsellor, async (req, res, next) => {
  try {
    const s = await prisma.portalSubmission.findUnique({ where: { id: req.params.id } });
    const c = s && (await ownedConnection(req, s.portalConnectionId));
    if (!s || !c) return res.status(404).json({ error: "Submission not found." });
    const job = await prisma.portalJob.findFirst({ where: { submissionId: s.id, screenshot: { not: null } }, orderBy: { updatedAt: "desc" } });
    if (!job?.screenshot) return res.status(404).json({ error: "No preview available yet." });
    const file = path.join(SHOTS_DIR, path.basename(job.screenshot));
    if (!fs.existsSync(file)) return res.status(404).json({ error: "Preview expired." });
    res.type("png").sendFile(file);
  } catch (err) { next(err); }
});

module.exports = router;
