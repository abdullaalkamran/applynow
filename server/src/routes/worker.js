// Service-authenticated API for the portal worker (portal-worker/): claim a job, report what happened, and have the
// results written back into the platform. Every write-back reuses existing models and the same journey/notification
// logic a counsellor's own edit goes through — and, by design, the worker never changes an application's official
// status: portal changes become comments, document requests and a task for the counsellor to review.
const fs = require("fs");
const path = require("path");
const express = require("express");
const prisma = require("../prismaClient");
const workerAuth = require("../middleware/workerAuth");
const { decrypt } = require("../secretBox");
const applicationsRouter = require("./applications");
const journey = require("../journeyLogic");

const router = express.Router();
router.use(workerAuth);

const SHOTS_DIR = path.join(__dirname, "..", "..", "data", "portal-shots");
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 2; // stop after this many consecutive failures so a wrong password can't lock the portal account
const AGENT_NAME = "AI Agent";

const audit = (action, extra = {}) =>
  prisma.portalAuditLog.create({ data: { actorType: "worker", action, ...extra } }).catch(() => undefined);

async function studentProfile(studentId) {
  const rows = await prisma.studentProfileSection.findMany({ where: { studentId } });
  return Object.fromEntries(rows.map((r) => [r.section, r.data]));
}

async function buildPayload(job) {
  const submission = await prisma.portalSubmission.findUnique({ where: { id: job.submissionId } });
  const connection = await prisma.portalConnection.findUnique({ where: { id: submission.portalConnectionId } });
  const app = await prisma.application.findUnique({ where: { id: submission.applicationId } });
  const student = await prisma.student.findUnique({ where: { id: app.studentId } });
  const documents = await prisma.document.findMany({ where: { studentId: student.id, fileUrl: { not: null }, status: { in: ["uploaded", "verified", "under_review"] } } });
  return {
    job: { id: job.id, kind: job.kind },
    submission: { id: submission.id, applicationId: submission.applicationId, externalRef: submission.externalRef || undefined, snapshot: submission.snapshot || undefined },
    portal: { id: connection.id, name: connection.name, url: connection.url, kind: connection.kind, username: decrypt(connection.usernameEnc), password: decrypt(connection.passwordEnc) },
    application: { id: app.id, university: app.university, course: app.course, intake: app.intake, country: app.country, campus: app.campus || undefined },
    student: { id: student.id, name: student.name, email: student.email, phone: student.phone || undefined, country: student.country, profile: await studentProfile(student.id) },
    documents: documents.map((d) => ({ id: d.id, name: d.name, type: d.type, fileUrl: d.fileUrl })),
  };
}

// Hands the worker its next job: a queued one if any, otherwise a periodic status check that's come due.
router.post("/jobs/claim", async (req, res, next) => {
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      let job = await prisma.portalJob.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" } });
      if (!job) {
        const healthy = await prisma.portalConnection.findMany({ where: { failedLogins: { lt: MAX_FAILED_LOGINS } }, select: { id: true } });
        const due = await prisma.portalSubmission.findFirst({
          where: {
            status: "submitted", portalConnectionId: { in: healthy.map((c) => c.id) },
            OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - CHECK_EVERY_MS) } }],
          },
          orderBy: { lastCheckedAt: "asc" },
        });
        if (!due) return res.json({ job: null });
        const open = await prisma.portalJob.findFirst({ where: { submissionId: due.id, kind: "check", status: { in: ["queued", "running"] } } });
        if (open) return res.json({ job: null });
        job = await prisma.portalJob.create({ data: { submissionId: due.id, kind: "check" } });
      }
      const claimed = await prisma.portalJob.updateMany({ where: { id: job.id, status: "queued" }, data: { status: "running" } });
      if (claimed.count === 0) continue; // another worker got it
      if (job.kind === "submit") await prisma.portalSubmission.update({ where: { id: job.submissionId }, data: { status: "preparing" } });
      await audit("job_claimed", { detail: `${job.kind} ${job.id}` });
      return res.json(await buildPayload(job));
    }
    res.json({ job: null });
  } catch (err) { next(err); }
});

async function notifyCounsellor(counsellorId, app, type, title, body) {
  await prisma.notification.create({
    data: { userId: counsellorId, userRole: "counsellor", type, title, body: body?.slice(0, 280), studentId: app.studentId, applicationId: app.id },
  });
}

async function createReviewTask(counsellorId, app, title, description) {
  const student = await prisma.student.findUnique({ where: { id: app.studentId }, select: { name: true } });
  await prisma.task.create({
    data: {
      title: title.slice(0, 191), description, assignedToId: counsellorId, assignedToRole: "counsellor", assignedToName: "Counsellor",
      assignedById: counsellorId, assignedByRole: "counsellor", assignedByName: AGENT_NAME,
      studentId: app.studentId, studentName: student?.name, applicationId: app.id, taskType: "portal", priority: "high",
    },
  });
}

// Turns what the monitor read off a portal into platform records. Idempotent: the snapshot remembers which comments,
// required documents and status were already reported, so repeated checks only surface what's actually new.
async function writeBack({ submission, connection, app, report }) {
  const prev = submission.snapshot || {};
  const seenComments = new Set(prev.commentIds || []);
  const seenDocs = new Set((prev.requiredDocs || []).map((d) => d.toLowerCase()));
  const actor = { id: connection.counsellorId, role: "counsellor", name: AGENT_NAME };
  const participants = await applicationsRouter.helpers.getApplicationParticipants(app);
  const changes = [];

  const newComments = (report.comments || []).filter((c) => c && c.id && c.text && !seenComments.has(String(c.id))).slice(0, 20);
  for (const c of newComments) {
    const row = await prisma.applicationActivity.create({
      data: { applicationId: app.id, action: "comment_added", notes: `[${connection.name} portal] ${String(c.text).slice(0, 2000)}`, performedById: actor.id, performedByRole: actor.role, performedByName: actor.name },
    });
    await prisma.notification.createMany({
      data: participants.map((p) => ({ userId: p.id, userRole: p.role, type: "comment_added", title: `New message on ${connection.name} for ${app.university} — ${app.course}`, body: String(c.text).slice(0, 280), studentId: app.studentId, applicationId: app.id, activityId: row.id })),
    });
    seenComments.add(String(c.id));
    changes.push("comment");
  }

  const newDocs = (report.requiredDocuments || []).map((d) => String(d).trim()).filter((d) => d && !seenDocs.has(d.toLowerCase())).slice(0, 20);
  for (const name of newDocs) {
    const exists = await prisma.document.findFirst({ where: { studentId: app.studentId, applicationId: app.id, type: name, status: { in: ["requested", "uploaded", "verified"] } } });
    if (!exists) {
      await prisma.document.create({ data: { studentId: app.studentId, applicationId: app.id, scope: "application", name, type: name, status: "requested", custom: true, note: `Requested by ${connection.name}` } });
      await prisma.applicationActivity.create({ data: { applicationId: app.id, action: "document_requested", newValue: name, performedById: actor.id, performedByRole: actor.role, performedByName: actor.name } });
      await prisma.notification.createMany({
        data: participants.filter((p) => p.role === "student" || p.role === "counsellor").map((p) => ({ userId: p.id, userRole: p.role, type: "document_requested", title: `Document requested: ${name}`, body: `${connection.name} needs "${name}" for ${app.university} — ${app.course}.`, studentId: app.studentId, applicationId: app.id })),
      });
    }
    seenDocs.add(name.toLowerCase());
    changes.push("document");
  }

  let portalStatus = prev.portalStatus;
  const newStatus = typeof report.portalStatus === "string" ? report.portalStatus.trim().slice(0, 200) : "";
  if (newStatus && newStatus !== prev.portalStatus) {
    await prisma.applicationActivity.create({ data: { applicationId: app.id, action: "portal_status_changed", oldValue: prev.portalStatus || null, newValue: newStatus, notes: `${connection.name} portal`, performedById: actor.id, performedByRole: actor.role, performedByName: actor.name } });
    // Official status stays a human decision — the counsellor gets a task to review the change.
    if (prev.portalStatus) await createReviewTask(connection.counsellorId, app, `Review ${connection.name} status change: ${newStatus}`, `The portal now shows "${newStatus}" (was "${prev.portalStatus}") for ${app.university} — ${app.course}. Update the application status here if appropriate.`);
    portalStatus = newStatus;
    changes.push("status");
  }
  if (changes.length) await notifyCounsellor(connection.counsellorId, app, "portal_update", `${connection.name}: ${changes.length} update${changes.length === 1 ? "" : "s"} for ${app.university}`, `Found: ${[...new Set(changes)].join(", ")}.`);

  return { ...prev, commentIds: [...seenComments].slice(-200), requiredDocs: [...seenDocs].slice(-200), portalStatus, lastChanges: changes };
}

// The worker reports a job's outcome. `status`: awaiting_confirm | done | failed | needs_human.
router.post("/jobs/:id/report", async (req, res, next) => {
  try {
    const job = await prisma.portalJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: "Job not found." });
    const submission = await prisma.portalSubmission.findUnique({ where: { id: job.submissionId } });
    const connection = await prisma.portalConnection.findUnique({ where: { id: submission.portalConnectionId } });
    const app = await prisma.application.findUnique({ where: { id: submission.applicationId } });
    const r = req.body || {};
    const status = ["awaiting_confirm", "done", "failed", "needs_human"].includes(r.status) ? r.status : "failed";
    const error = typeof r.error === "string" ? r.error.slice(0, 1000) : undefined;
    const log = Array.isArray(r.log) ? r.log.map((l) => String(l).slice(0, 300)).slice(-100) : undefined;

    let screenshot;
    if (typeof r.screenshotBase64 === "string" && r.screenshotBase64.length < 8_000_000) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      screenshot = `${job.id}-${Date.now()}.png`;
      fs.writeFileSync(path.join(SHOTS_DIR, screenshot), Buffer.from(r.screenshotBase64, "base64"));
    }
    await prisma.portalJob.update({ where: { id: job.id }, data: { status, log, ...(screenshot ? { screenshot } : {}) } });

    // Login outcome bookkeeping — the claim query stops scheduling checks after repeated failures.
    if (r.loginFailed) {
      const failed = connection.failedLogins + 1;
      await prisma.portalConnection.update({ where: { id: connection.id }, data: { lastLoginOk: false, lastLoginAt: new Date(), failedLogins: failed } });
      if (failed >= MAX_FAILED_LOGINS) await createReviewTask(connection.counsellorId, app, `Fix ${connection.name} portal login`, `Logging in to ${connection.name} failed ${failed} times, so the AI agent has stopped trying. Update the saved credentials in Portals.`);
    } else if (r.loginOk) {
      await prisma.portalConnection.update({ where: { id: connection.id }, data: { lastLoginOk: true, lastLoginAt: new Date(), failedLogins: 0 } });
    }

    const subData = { lastError: error ?? null };
    let snapshot = submission.snapshot || undefined;

    if (job.kind === "submit") {
      if (status === "awaiting_confirm") {
        subData.status = "awaiting_confirm";
        // The portal's own draft/application id, so the later confirm job can reopen exactly this draft.
        if (r.draftRef) snapshot = { ...(submission.snapshot || {}), draftRef: String(r.draftRef).slice(0, 190) };
        await notifyCounsellor(connection.counsellorId, app, "portal_confirm", `Ready to submit to ${connection.name}`, `The AI agent filled in ${app.university} — ${app.course} and is waiting for your final confirmation.`);
      } else if (status === "needs_human") {
        subData.status = "needs_human";
        await createReviewTask(connection.counsellorId, app, `Finish ${connection.name} submission manually`, error || "The AI agent needs help (CAPTCHA, verification code or an unexpected page).");
      } else subData.status = "failed";
    } else if (job.kind === "confirm_submit") {
      if (status === "done") {
        subData.status = "submitted";
        subData.submittedAt = new Date();
        if (r.externalRef) subData.externalRef = String(r.externalRef).slice(0, 190);
        // Record where it went on the application's own journey stage (data only — status is untouched).
        const record = await prisma.applicationJourney.findUnique({ where: { applicationId: app.id } });
        const { updatedStage, oldStatus } = applicationsRouter.helpers.computeUpdatedStage(record?.stages ?? journey.buildInitialStages(app.country), "application", {
          appliedVia: connection.kind === "b2b" ? "B2B Portal" : "Direct University Portal", portalName: connection.name, portalUrl: connection.url,
          portalSubmissionDate: new Date().toISOString().slice(0, 10), ...(r.externalRef ? { applicationRef: String(r.externalRef).slice(0, 190) } : {}),
        });
        await applicationsRouter.helpers.applyStageToApplication(app.id, "application", updatedStage, oldStatus, { id: connection.counsellorId, role: "counsellor", name: AGENT_NAME });
        await notifyCounsellor(connection.counsellorId, app, "portal_submitted", `Submitted to ${connection.name}`, `${app.university} — ${app.course}${r.externalRef ? ` (ref ${r.externalRef})` : ""}.`);
      } else if (status === "needs_human") {
        subData.status = "needs_human";
        await createReviewTask(connection.counsellorId, app, `Finish ${connection.name} submission manually`, error || "The AI agent couldn't complete the final step.");
      } else subData.status = "awaiting_confirm"; // couldn't click — let the counsellor retry the confirmation
    } else if (job.kind === "check") {
      subData.lastCheckedAt = new Date();
      if (status === "done") snapshot = await writeBack({ submission, connection, app, report: r });
      else if (status === "needs_human") await createReviewTask(connection.counsellorId, app, `Check ${connection.name} portal manually`, error || "The AI agent couldn't read the portal (verification step or changed page).");
    }

    await prisma.portalSubmission.update({ where: { id: submission.id }, data: { ...subData, ...(snapshot !== undefined ? { snapshot } : {}) } });
    await audit(`job_${job.kind}_${status}`, { portalConnectionId: connection.id, applicationId: app.id, detail: error });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
