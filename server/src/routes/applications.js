const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { toEnum, toHuman } = require("../appStatusMap");
const { workflowStages } = require("../workflowStages");
const journey = require("../journeyLogic");
const { saveFinancialReadiness } = require("../financialReadinessRecord");
const { sendStatusNotification } = require("../notifications/dispatch");
const { threadIdFor } = require("./messages");
const { requireInternal, applicationWhere, accessibleApplication, accessibleStudent, isInternal } = require("../middleware/access");

const router = express.Router();

const NOT_FOUND = { error: "Application not found." };

function serializeApplication(a) {
  return {
    id: a.id,
    studentId: a.studentId,
    university: a.university,
    course: a.course,
    intake: a.intake,
    country: a.country,
    campus: a.campus || undefined,
    status: toHuman(a.status),
    progress: a.progress,
    nextAction: a.nextAction,
    waitingOn: a.waitingOn,
    stages: a.stages,
    updatedAt: a.updatedAt.toISOString().slice(0, 10),
    source: a.source || undefined,
    responsibleCounsellorId: a.responsibleCounsellorId || undefined,
    responsibleAdmissionOfficerId: a.responsibleAdmissionOfficerId || undefined,
    createdAt: a.createdAt.toISOString(),
  };
}

function actorFrom(req) {
  return { id: req.authUser.roleUserId, role: req.authUser.role, name: req.authUser.name };
}

/** Builds the WhatsApp/email recipient list for a status-change notification — student, their
 * counsellor, and their agent, same fan-out as the frontend's (now-retired) notificationDispatch.ts.
 * Known Phase-1 gap: a student's onboarding-captured phone (studentProfileDetailsStore.ts) isn't
 * in Postgres yet, so only the base Student.phone column is checked here. */
async function recipientsAndVariablesFor(application) {
  const student = await prisma.student.findUnique({ where: { id: application.studentId } });
  if (!student) return { recipients: [], variables: {} };

  const staffIds = [student.counsellorId, student.agentId].filter(Boolean);
  const staff = staffIds.length ? await prisma.staff.findMany({ where: { id: { in: staffIds } } }) : [];
  const contacts = [student, ...staff];

  const recipients = [];
  for (const contact of contacts) {
    if (contact.phone) recipients.push({ channel: "whatsapp", to: contact.phone });
    if (contact.email) recipients.push({ channel: "email", to: contact.email });
  }

  const variables = {
    studentName: student.name,
    university: application.university,
    course: application.course,
    status: toHuman(application.status),
    nextAction: application.nextAction || "",
  };
  return { recipients, variables };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { studentId, status, responsibleCounsellorId } = req.query;
    // Scoped to what the caller may see (own applications for a student, own students' for an
    // agent) — the query filters below only ever narrow that further.
    const where = { ...applicationWhere(req.authUser) };
    if (studentId) where.studentId = String(studentId);
    if (status) where.status = toEnum(String(status));
    if (responsibleCounsellorId) where.responsibleCounsellorId = String(responsibleCounsellorId);
    const apps = await prisma.application.findMany({ where, orderBy: { createdAt: "asc" } });
    res.json(apps.map(serializeApplication));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const app = await accessibleApplication(req.authUser, req.params.id);
    if (!app) return res.status(404).json(NOT_FOUND);
    res.json(serializeApplication(app));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { university, course, intake, country, campus } = req.body || {};
    // A student can only ever apply as themselves; an agent only for a student they referred.
    // `source` is derived from who's actually calling, not trusted from the body — it decides
    // whether the counsellor gets a "review this" task below.
    const studentId = req.authUser.role === "student" ? req.authUser.roleUserId : req.body?.studentId;
    const source = req.authUser.role === "student" ? "student" : "counsellor";
    if (!studentId || !university || !course || !intake || !country) {
      return res.status(400).json({ error: "studentId, university, course, intake and country are required." });
    }
    for (const [key, value] of Object.entries({ university, course, intake, country })) {
      if (typeof value !== "string") return res.status(400).json({ error: `${key} must be a string.` });
    }
    if (!(await accessibleStudent(req.authUser, studentId))) return res.status(404).json({ error: "Student not found." });

    // A withdrawn or rejected application doesn't block a fresh attempt — anything else in
    // flight (or already successful) for the same student/university/course does.
    const duplicate = await prisma.application.findFirst({
      where: {
        studentId,
        university,
        course,
        status: { notIn: ["Withdrawn", "Rejected"] },
      },
    });
    if (duplicate) {
      return res.status(409).json({ error: `You've already applied to ${course} at ${university}.` });
    }

    const id = `app-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const actor = actorFrom(req);
    const app = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          id, studentId, university, course, intake, country, campus: typeof campus === "string" ? campus : undefined,
          status: "Submitted",
          progress: 15,
          nextAction: "Awaiting university confirmation of receipt",
          waitingOn: "university",
          stages: workflowStages(2),
          source,
        },
      });
      // A student who already filled in Financial Readiness (it's one shared record per student,
      // fillable before any application exists) gets it carried into this journey from the start.
      const sharedFinancial = await tx.studentFinancialReadiness.findUnique({ where: { studentId } });
      await tx.applicationJourney.create({
        data: { applicationId: id, stages: journey.syncFinancialReadinessStage(journey.buildInitialStages(country), sharedFinancial) },
      });

      // Auto-assign a "review this" task to the student's responsible counsellor — otherwise a
      // student-submitted application only surfaces via the WhatsApp/email ping below, with
      // nothing on the counsellor's own Tasks page prompting them to actually go look at it.
      // Scoped to the student's own submissions — a counsellor creating an application on a
      // student's behalf already knows about it, so there's nothing to remind them of.
      const student = source === "student" ? await tx.student.findUnique({ where: { id: studentId } }) : null;
      if (student?.counsellorId) {
        const counsellor = await tx.staff.findUnique({ where: { id: student.counsellorId } });
        if (counsellor) {
          await tx.task.create({
            data: {
              id: `tk-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
              title: `Review new application: ${course} at ${university}`,
              description: `${student.name} submitted an application to ${course} at ${university} (${intake} intake).`,
              assignedToId: counsellor.id, assignedToRole: "counsellor", assignedToName: counsellor.name,
              assignedById: actor.id, assignedByRole: actor.role, assignedByName: actor.name,
              studentId: student.id, studentName: student.name,
              applicationId: id,
              taskType: "application_review",
              priority: "medium",
            },
          });
        }
      }

      return created;
    });

    // Same notification path the status-PATCH route uses — a brand-new application is created
    // straight into "Submitted", which never goes through that route, so without this the
    // student's counsellor/agent never gets the WhatsApp/email "Submitted" alert at all.
    const { recipients, variables } = await recipientsAndVariablesFor(app);
    if (recipients.length > 0) {
      sendStatusNotification({ status: "Submitted", recipients, variables }).catch((err) =>
        console.warn("New-application notification failed to send:", err)
      );
    }

    res.status(201).json(serializeApplication(app));
  } catch (err) {
    next(err);
  }
});

// The funnel route every status change goes through — replaces applicationsStore.ts's
// updateApplicationStatus(): writes the status, a history row, an activity row (if the status
// actually changed), then fires the WhatsApp/email notification in-process (no second round trip).
router.patch("/:id/status", requireAuth, requireInternal, async (req, res, next) => {
  try {
    const { status, nextAction } = req.body || {};
    if (typeof status !== "string") return res.status(400).json({ error: "status is required." });
    if (nextAction !== undefined && typeof nextAction !== "string") return res.status(400).json({ error: "nextAction must be a string." });
    const statusEnum = toEnum(status);
    const actor = actorFrom(req);

    const { updated, previousStatus } = await prisma.$transaction(async (tx) => {
      const current = await tx.application.findUnique({ where: { id: req.params.id } });
      if (!current) throw Object.assign(new Error("Application not found."), { status: 404 });
      const previousStatus = toHuman(current.status);

      const updated = await tx.application.update({
        where: { id: req.params.id },
        data: { status: statusEnum, ...(nextAction !== undefined ? { nextAction } : {}) },
      });

      await tx.applicationStatusHistory.create({ data: { applicationId: req.params.id, status: statusEnum } });

      if (status !== previousStatus) {
        await tx.applicationActivity.create({
          data: {
            applicationId: req.params.id, action: "status_changed",
            oldValue: previousStatus, newValue: status,
            performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
          },
        });
      }

      return { updated, previousStatus };
    });

    if (status !== previousStatus) {
      const { recipients, variables } = await recipientsAndVariablesFor(updated);
      if (recipients.length > 0) {
        sendStatusNotification({ status, recipients, variables }).catch((err) =>
          console.warn("Status-change notification failed to send:", err)
        );
      }
    }

    res.json(serializeApplication(updated));
  } catch (err) {
    next(err);
  }
});

// counsellorId is optional — an empty value clears the assignment back to "Unassigned" (the
// counsellor UI's own dropdown offers that option), it's only ever *rejected* outright if the body
// is missing the field altogether in a way that suggests a malformed request... which in practice
// never happens here, so this just accepts empty/absent equally and clears the field.
router.patch("/:id/assign-counsellor", requireAuth, requireInternal, async (req, res, next) => {
  try {
    const { counsellorId } = req.body || {};
    const value = typeof counsellorId === "string" && counsellorId ? counsellorId : null;
    const actor = actorFrom(req);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.application.findUnique({ where: { id: req.params.id } });
      if (!current) throw Object.assign(new Error("Application not found."), { status: 404 });
      const updated = await tx.application.update({ where: { id: req.params.id }, data: { responsibleCounsellorId: value } });
      await tx.applicationActivity.create({
        data: {
          applicationId: req.params.id, action: "counsellor_assigned",
          oldValue: current.responsibleCounsellorId, newValue: value,
          performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
        },
      });
      return updated;
    });

    res.json(serializeApplication(updated));
  } catch (err) {
    next(err);
  }
});

// Same "empty clears it" rule as assign-counsellor above.
router.patch("/:id/assign-admission-officer", requireAuth, requireInternal, async (req, res, next) => {
  try {
    const { officerId } = req.body || {};
    const value = typeof officerId === "string" && officerId ? officerId : null;
    const actor = actorFrom(req);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.application.findUnique({ where: { id: req.params.id } });
      if (!current) throw Object.assign(new Error("Application not found."), { status: 404 });
      const updated = await tx.application.update({ where: { id: req.params.id }, data: { responsibleAdmissionOfficerId: value } });
      await tx.applicationActivity.create({
        data: {
          applicationId: req.params.id, action: "admission_officer_assigned",
          oldValue: current.responsibleAdmissionOfficerId, newValue: value,
          performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
        },
      });
      return updated;
    });

    res.json(serializeApplication(updated));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/status-history", requireAuth, async (req, res, next) => {
  try {
    if (!(await accessibleApplication(req.authUser, req.params.id))) return res.status(404).json(NOT_FOUND);
    const rows = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: req.params.id },
      orderBy: { changedAt: "asc" },
    });
    res.json(rows.map((r) => ({ status: toHuman(r.status), changedAt: r.changedAt.toISOString().slice(0, 10) })));
  } catch (err) {
    next(err);
  }
});

/** Everyone tied to this specific application — the student, whoever's actually responsible for
 * it (counsellor/admission officer), plus the student's overall agent/counsellor (which can differ
 * from the per-application responsible staff — see the Application model's own comment). Used to
 * gate who can read/post comments on an application and who gets notified of a new one. Deduped by
 * id+role since the same person often appears twice (e.g. responsibleCounsellorId === student's
 * own counsellorId). */
async function getApplicationParticipants(application) {
  const student = await prisma.student.findUnique({ where: { id: application.studentId } });
  if (!student) return [];

  const staffIds = [
    application.responsibleCounsellorId,
    application.responsibleAdmissionOfficerId,
    student.counsellorId,
    student.agentId,
  ].filter(Boolean);
  const staff = staffIds.length ? await prisma.staff.findMany({ where: { id: { in: staffIds } } }) : [];

  const participants = [{ id: student.id, role: "student", name: student.name }];
  for (const s of staff) participants.push({ id: s.id, role: s.role, name: s.name });

  const seen = new Set();
  return participants.filter((p) => {
    const key = `${p.role}:${p.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function serializeActivity(r) {
  return {
    id: r.id,
    applicationId: r.applicationId,
    timestamp: r.timestamp.toISOString(),
    stageType: r.stageType || undefined,
    action: r.action,
    oldValue: r.oldValue,
    newValue: r.newValue,
    notes: r.notes || undefined,
    performedBy: { id: r.performedById, role: r.performedByRole, name: r.performedByName },
  };
}

// Same access rule as GET /:id (see middleware/access.js): a student sees their own application's
// activity, an agent their students', internal staff any — including a legitimate staff member
// who isn't yet the officially-assigned responsible party for this specific application (e.g. an
// admission officer before one's been assigned).
router.get("/:id/activity", requireAuth, async (req, res, next) => {
  try {
    const app = await accessibleApplication(req.authUser, req.params.id);
    if (!app) return res.status(404).json(NOT_FOUND);

    const rows = await prisma.applicationActivity.findMany({
      where: { applicationId: req.params.id },
      orderBy: { timestamp: "desc" },
    });
    res.json(rows.map(serializeActivity));
  } catch (err) {
    next(err);
  }
});

// For activity a client itself originates — a comment (action "comment_added", postable and
// visible to anyone, same as GET above) or the counsellor's request_document AI tool call — as
// opposed to the activity rows other routes in this file already create automatically alongside
// their own real effect (a status/stage change, a counsellor/admission-officer assignment).
// Always attributes to whoever is actually authenticated, never a client-supplied performer. A
// comment also notifies every actual participant's in-app inbox (see the Notification model) —
// unlike read/write access above, notifications *are* targeted, so posting a comment doesn't spam
// every authenticated user in the system.
router.post("/:id/activity", requireAuth, async (req, res, next) => {
  try {
    const { action, stageType, oldValue, newValue, notes } = req.body || {};
    if (typeof action !== "string" || !action.trim()) {
      return res.status(400).json({ error: "action is required." });
    }
    const app = await accessibleApplication(req.authUser, req.params.id);
    if (!app) return res.status(404).json(NOT_FOUND);
    // Students and agents can comment; only internal staff can record anything that reads like an
    // audit event (status_changed, document_requested, ...) — otherwise the trail could be forged.
    if (!isInternal(req.authUser) && action !== "comment_added") {
      return res.status(403).json({ error: "Only comments can be posted here." });
    }
    for (const [key, value] of Object.entries({ stageType, oldValue, newValue, notes })) {
      if (value !== undefined && value !== null && typeof value !== "string") {
        return res.status(400).json({ error: `${key} must be a string.` });
      }
    }
    const actor = actorFrom(req);

    const row = await prisma.applicationActivity.create({
      data: {
        applicationId: req.params.id,
        action,
        stageType: stageType || undefined,
        oldValue,
        newValue,
        notes: notes || undefined,
        performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
      },
    });

    if (action === "comment_added" && notes) {
      const participants = await getApplicationParticipants(app);
      const recipients = participants.filter((p) => !(p.id === actor.id && p.role === actor.role));
      if (recipients.length > 0) {
        await prisma.notification.createMany({
          data: recipients.map((p) => ({
            userId: p.id,
            userRole: p.role,
            type: "comment_added",
            title: `${actor.name} commented on ${app.university} — ${app.course}`,
            body: String(notes).slice(0, 280),
            studentId: app.studentId,
            applicationId: app.id,
            activityId: row.id,
          })),
        });
        // Also fans the comment out as an individual 1:1 message from the poster to each other
        // participant — so it shows up in their normal chat with that person, not just the
        // shared comment thread on the application itself.
        await prisma.message.createMany({
          data: recipients.map((p) => ({
            id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${p.id}`,
            threadId: threadIdFor(actor, p),
            fromId: actor.id, fromRole: actor.role, fromName: actor.name,
            toId: p.id, toRole: p.role, toName: p.name,
            text: `[${app.university} — ${app.course}] ${notes}`,
          })),
        });
      }
    }

    res.status(201).json(serializeActivity(row));
  } catch (err) {
    next(err);
  }
});

// --- Application → Enrolment 9-stage journey ---

/** The journey's stages with financial_readiness rebuilt from the student's shared record. */
async function withSharedFinancialReadiness(journeyRecord) {
  const app = await prisma.application.findUnique({ where: { id: journeyRecord.applicationId } });
  const shared = app ? await prisma.studentFinancialReadiness.findUnique({ where: { studentId: app.studentId } }) : null;
  return journey.syncFinancialReadinessStage(journeyRecord.stages, shared);
}

router.get("/:id/journey", requireAuth, async (req, res, next) => {
  try {
    const app = await accessibleApplication(req.authUser, req.params.id);
    if (!app) return res.status(404).json(NOT_FOUND);
    let record = await prisma.applicationJourney.findUnique({ where: { applicationId: req.params.id } });
    if (!record) {
      record = await prisma.applicationJourney.create({
        data: { applicationId: req.params.id, stages: journey.buildInitialStages(app.country) },
      });
    } else if (record.stages?.application?.status === "Incomplete Profile") {
      // One-time repair of journeys created with the old "Incomplete Profile" default — see
      // journeyLogic.repairLegacyApplicationStage. Done here on read (not a migration) so it also
      // covers rows restored from a dump after the migrations have already run.
      const repaired = journey.repairLegacyApplicationStage(record.stages, toHuman(app.status));
      if (repaired) {
        record = await prisma.applicationJourney.update({ where: { applicationId: req.params.id }, data: { stages: repaired } });
      }
    }
    // Always serve Financial Readiness from the shared per-student record (see
    // journeyLogic.syncFinancialReadinessStage) so a counsellor sees what the student saved
    // even if this particular application's copy was never written to.
    res.json({ applicationId: record.applicationId, stages: await withSharedFinancialReadiness(record) });
  } catch (err) {
    next(err);
  }
});

/** Merges a patch into one application's stage record and returns the computed StageRecord —
 * pure, no writes — shared by the primary edit below and, for Financial Readiness, every sibling
 * application it gets broadcast to (see the route), so both end up with byte-identical records. */
function computeUpdatedStage(currentStages, stageType, patch) {
  const current = currentStages[stageType];
  const oldStatus = current?.status;
  const nextData = { ...(current?.data ?? {}), ...patch };
  const { status: nextStatus, blocked, blockedReason, ...dataOnly } = nextData;

  const updatedStage = {
    stageType,
    applicable: current?.applicable ?? true,
    required: current?.required ?? true,
    status: nextStatus ?? current?.status ?? "",
    startedAt: current?.startedAt ?? new Date().toISOString(),
    completedAt: current?.completedAt,
    blocked: blocked ?? current?.blocked,
    blockedReason: blockedReason ?? current?.blockedReason,
    data: dataOnly,
  };
  if (nextStatus && journey.STAGE_TERMINAL_STATUS[stageType]?.includes(nextStatus) && !updatedStage.completedAt) {
    updatedStage.completedAt = new Date().toISOString();
  }
  return { updatedStage, oldStatus };
}

/** Persists an already-computed stage record onto one application: journey + stage_updated
 * activity, then re-derives the flat AppStatus/nextAction and updates the Application row (plus a
 * status-changed activity/history entry and notification when it actually changed). Shared between
 * the application actually being edited and, for Financial Readiness only, every sibling
 * application the edit gets broadcast to — same effect either way, so they can never end up
 * showing different things for what is now one shared piece of data. */
// Statuses that a journey edit must never pull an application back out of — for a *sibling*
// application that merely receives a broadcast Financial Readiness update, re-deriving the flat
// status would otherwise flip a Withdrawn/Rejected/Enrolled application back to "Submitted" and
// notify everyone about it.
const SETTLED_STATUSES = new Set(["Withdrawn", "Rejected", "Deferred", "Enrolled"]);

async function applyStageToApplication(applicationId, stageType, updatedStage, oldStatus, actor, { skipIfSettled = false } = {}) {
  let record = await prisma.applicationJourney.findUnique({ where: { applicationId } });
  if (!record) {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) return null;
    record = await prisma.applicationJourney.create({
      data: { applicationId, stages: journey.buildInitialStages(app.country) },
    });
  }
  const nextStages = { ...record.stages, [stageType]: updatedStage };

  await prisma.$transaction(async (tx) => {
    await tx.applicationJourney.update({ where: { applicationId }, data: { stages: nextStages } });
    await tx.applicationActivity.create({
      data: {
        applicationId, stageType, action: "stage_updated",
        oldValue: oldStatus, newValue: updatedStage.status,
        performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
      },
    });
  });

  const current = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!current) return nextStages;
  const previousStatus = toHuman(current.status);
  if (skipIfSettled && SETTLED_STATUSES.has(previousStatus)) return nextStages;

  const derivedStatus = journey.deriveAppStatus(nextStages);
  const derivedNextAction = journey.computeNextAction(nextStages)?.title ?? "Every stage of the journey is complete.";
  const updatedApp = await prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({ where: { id: applicationId }, data: { status: toEnum(derivedStatus), nextAction: derivedNextAction } });
    await tx.applicationStatusHistory.create({ data: { applicationId, status: toEnum(derivedStatus) } });
    if (derivedStatus !== previousStatus) {
      await tx.applicationActivity.create({
        data: {
          applicationId, action: "status_changed",
          oldValue: previousStatus, newValue: derivedStatus,
          performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
        },
      });
    }
    return updated;
  });

  if (derivedStatus !== previousStatus) {
    const { recipients, variables } = await recipientsAndVariablesFor(updatedApp);
    if (recipients.length > 0) {
      sendStatusNotification({ status: derivedStatus, recipients, variables }).catch((err) =>
        console.warn("Status-change notification failed to send:", err)
      );
    }
  }

  return nextStages;
}

// Merges a Financial Readiness stage's data into the one shared StudentFinancialReadiness record
// for that student — matches studentFinancialReadiness.js's own upsert rule so editing it from
// either door (a specific application's Journey panel, or the student's own form) behaves
// identically.
async function upsertSharedFinancialReadiness(studentId, updatedStage, actor) {
  const existing = await prisma.studentFinancialReadiness.findUnique({ where: { studentId } });
  const d = updatedStage.data || {};
  const data = {
    evidenceRequired: d.evidenceRequired ?? existing?.evidenceRequired ?? true,
    requiredAmount: d.requiredAmount ?? null,
    currency: d.currency ?? null,
    holdingPeriodDays: d.holdingPeriodDays ?? null,
    openingDate: d.openingDate ? new Date(d.openingDate) : null,
    maturityDate: d.maturityDate ? new Date(d.maturityDate) : null,
    bankStatus: updatedStage.status || existing?.bankStatus || "Not Started",
    bankName: d.bankName ?? null,
    accountHolder: d.accountHolder ?? null,
    accountType: d.accountType ?? null,
    depositType: d.depositType ?? null,
  };
  if (!existing?.completedAt && updatedStage.completedAt) {
    data.completedAt = new Date(updatedStage.completedAt);
  }
  // Shared write path with studentFinancialReadiness.js — records the history entry too.
  await saveFinancialReadiness(studentId, data, actor);
}

/** Only plain scalar fields (and short string arrays) may land in a stage's `data` — the body is
 * persisted as JSON on the journey row, so without this an arbitrary nested payload would be
 * stored verbatim and grow unbounded. */
function sanitizeStagePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) return null;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      if (typeof value === "string" && value.length > 4000) return null;
      out[key] = value;
    } else if (Array.isArray(value) && value.length <= 100 && value.every((v) => typeof v === "string" && v.length <= 500)) {
      out[key] = value;
    } else {
      return null;
    }
  }
  return out;
}

router.patch("/:id/journey/:stageType", requireAuth, requireInternal, async (req, res, next) => {
  try {
    const { stageType } = req.params;
    if (!journey.STAGE_ORDER.includes(stageType)) {
      return res.status(400).json({ error: `Unknown stage type "${stageType}".` });
    }
    const patch = sanitizeStagePatch(req.body || {});
    if (!patch) return res.status(400).json({ error: "Stage data must be flat key/value fields." });
    const actor = actorFrom(req);

    let record = await prisma.applicationJourney.findUnique({ where: { applicationId: req.params.id } });
    if (!record) {
      const app = await prisma.application.findUnique({ where: { id: req.params.id } });
      if (!app) return res.status(404).json(NOT_FOUND);
      record = await prisma.applicationJourney.create({
        data: { applicationId: req.params.id, stages: journey.buildInitialStages(app.country) },
      });
    }

    // Merge a Financial Readiness patch over the shared record, never over this application's
    // possibly-stale copy — otherwise a one-field edit here would write stale values back over
    // everything the student (or another application's editor) had saved since.
    const baseStages = stageType === "financial_readiness" ? await withSharedFinancialReadiness(record) : record.stages;
    const { updatedStage, oldStatus } = computeUpdatedStage(baseStages, stageType, patch);
    const nextStages = await applyStageToApplication(req.params.id, stageType, updatedStage, oldStatus, actor);

    // Financial Readiness is one shared record per student (see the StudentFinancialReadiness
    // table/studentFinancialReadiness.js), not an independent copy per application — persisting
    // this and broadcasting it to every sibling application here, server-side, means it happens
    // reliably regardless of which client made the edit (or how stale that client's own JS is),
    // instead of depending on every client to correctly replicate the same fan-out itself.
    if (stageType === "financial_readiness") {
      const app = await prisma.application.findUnique({ where: { id: req.params.id } });
      if (app) {
        await upsertSharedFinancialReadiness(app.studentId, updatedStage, actor);
        const siblings = await prisma.application.findMany({
          where: { studentId: app.studentId, id: { not: req.params.id } },
        });
        for (const sibling of siblings) {
          const siblingRecord = await prisma.applicationJourney.findUnique({ where: { applicationId: sibling.id } });
          const siblingOldStatus = siblingRecord?.stages?.[stageType]?.status;
          // A sibling that's already settled (withdrawn, enrolled, ...) gets the shared record
          // copied in but keeps its status — see SETTLED_STATUSES.
          await applyStageToApplication(sibling.id, stageType, updatedStage, siblingOldStatus, actor, { skipIfSettled: true });
        }
      }
    }

    res.json({ applicationId: req.params.id, stages: nextStages });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
