const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { toEnum, toHuman } = require("../appStatusMap");
const { workflowStages } = require("../workflowStages");
const journey = require("../journeyLogic");
const { sendStatusNotification } = require("../notifications/dispatch");

const router = express.Router();

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
    const where = {};
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
    const app = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!app) return res.status(404).json({ error: "Application not found." });
    res.json(serializeApplication(app));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { studentId, university, course, intake, country, campus, source } = req.body || {};
    if (!studentId || !university || !course || !intake || !country) {
      return res.status(400).json({ error: "studentId, university, course, intake and country are required." });
    }

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

    const id = `app-custom-${Date.now()}`;
    const actor = actorFrom(req);
    const app = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          id, studentId, university, course, intake, country, campus,
          status: "Submitted",
          progress: 15,
          nextAction: "Awaiting university confirmation of receipt",
          waitingOn: "university",
          stages: workflowStages(2),
          source: source || "counsellor",
        },
      });
      await tx.applicationJourney.create({
        data: { applicationId: id, stages: journey.buildInitialStages(country) },
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
router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const { status, nextAction } = req.body || {};
    if (typeof status !== "string") return res.status(400).json({ error: "status is required." });
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

router.patch("/:id/assign-counsellor", requireAuth, async (req, res, next) => {
  try {
    const { counsellorId } = req.body || {};
    if (!counsellorId) return res.status(400).json({ error: "counsellorId is required." });
    const actor = actorFrom(req);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.application.findUnique({ where: { id: req.params.id } });
      if (!current) throw Object.assign(new Error("Application not found."), { status: 404 });
      const updated = await tx.application.update({ where: { id: req.params.id }, data: { responsibleCounsellorId: counsellorId } });
      await tx.applicationActivity.create({
        data: {
          applicationId: req.params.id, action: "counsellor_assigned",
          oldValue: current.responsibleCounsellorId, newValue: counsellorId,
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

router.patch("/:id/assign-admission-officer", requireAuth, async (req, res, next) => {
  try {
    const { officerId } = req.body || {};
    if (!officerId) return res.status(400).json({ error: "officerId is required." });
    const actor = actorFrom(req);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.application.findUnique({ where: { id: req.params.id } });
      if (!current) throw Object.assign(new Error("Application not found."), { status: 404 });
      const updated = await tx.application.update({ where: { id: req.params.id }, data: { responsibleAdmissionOfficerId: officerId } });
      await tx.applicationActivity.create({
        data: {
          applicationId: req.params.id, action: "admission_officer_assigned",
          oldValue: current.responsibleAdmissionOfficerId, newValue: officerId,
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
    const rows = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: req.params.id },
      orderBy: { changedAt: "asc" },
    });
    res.json(rows.map((r) => ({ status: toHuman(r.status), changedAt: r.changedAt.toISOString().slice(0, 10) })));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/activity", requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.applicationActivity.findMany({
      where: { applicationId: req.params.id },
      orderBy: { timestamp: "desc" },
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        applicationId: r.applicationId,
        timestamp: r.timestamp.toISOString(),
        stageType: r.stageType || undefined,
        action: r.action,
        oldValue: r.oldValue,
        newValue: r.newValue,
        performedBy: { id: r.performedById, role: r.performedByRole, name: r.performedByName },
      }))
    );
  } catch (err) {
    next(err);
  }
});

// --- Application → Enrolment 9-stage journey ---

router.get("/:id/journey", requireAuth, async (req, res, next) => {
  try {
    let record = await prisma.applicationJourney.findUnique({ where: { applicationId: req.params.id } });
    if (!record) {
      const app = await prisma.application.findUnique({ where: { id: req.params.id } });
      if (!app) return res.status(404).json({ error: "Application not found." });
      record = await prisma.applicationJourney.create({
        data: { applicationId: req.params.id, stages: journey.buildInitialStages(app.country) },
      });
    }
    res.json({ applicationId: record.applicationId, stages: record.stages });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/journey/:stageType", requireAuth, async (req, res, next) => {
  try {
    const { stageType } = req.params;
    if (!journey.STAGE_ORDER.includes(stageType)) {
      return res.status(400).json({ error: `Unknown stage type "${stageType}".` });
    }
    const patch = req.body || {};
    const actor = actorFrom(req);

    let record = await prisma.applicationJourney.findUnique({ where: { applicationId: req.params.id } });
    if (!record) {
      const app = await prisma.application.findUnique({ where: { id: req.params.id } });
      if (!app) return res.status(404).json({ error: "Application not found." });
      record = await prisma.applicationJourney.create({
        data: { applicationId: req.params.id, stages: journey.buildInitialStages(app.country) },
      });
    }

    const current = record.stages[stageType];
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

    const nextStages = { ...record.stages, [stageType]: updatedStage };

    await prisma.$transaction(async (tx) => {
      await tx.applicationJourney.update({ where: { applicationId: req.params.id }, data: { stages: nextStages } });
      await tx.applicationActivity.create({
        data: {
          applicationId: req.params.id, stageType, action: "stage_updated",
          oldValue: oldStatus, newValue: updatedStage.status,
          performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
        },
      });
    });

    const derivedStatus = journey.deriveAppStatus(nextStages);
    const derivedNextAction = journey.computeNextAction(nextStages)?.title ?? "Every stage of the journey is complete.";

    const current2 = await prisma.application.findUnique({ where: { id: req.params.id } });
    const previousStatus = toHuman(current2.status);
    const updatedApp = await prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({ where: { id: req.params.id }, data: { status: toEnum(derivedStatus), nextAction: derivedNextAction } });
      await tx.applicationStatusHistory.create({ data: { applicationId: req.params.id, status: toEnum(derivedStatus) } });
      if (derivedStatus !== previousStatus) {
        await tx.applicationActivity.create({
          data: {
            applicationId: req.params.id, action: "status_changed",
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

    res.json({ applicationId: req.params.id, stages: nextStages });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
