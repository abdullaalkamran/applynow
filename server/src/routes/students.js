const express = require("express");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { threadIdFor } = require("./messages");
const { requireStaff, requireAdminRole, studentWhere, accessibleStudent, isInternal } = require("../middleware/access");

const router = express.Router();

const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];

const RISK_FLAGS = ["none", "watch", "high"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One canonical form for an address — the User (login) row is always stored lowercased, so
 * the Student row must be too or the two drift apart and "already registered" checks miss. */
function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/** Ids stay in their existing `st-<base36 time>` shape but carry a random suffix, so two students
 * registered in the same millisecond can't collide on the primary key. */
function newStudentId() {
  return `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Whether a student actually has a working login (a User row) yet — same idea as staff.js's
 * attachHasLogin: a student registered by an agent/counsellor without a password has a Student
 * record but no way to sign in until an admin sets one (see PATCH /:id below). */
async function attachHasLogin(rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  const users = await prisma.user.findMany({
    where: { role: "student", roleUserId: { in: list.map((s) => s.id) } },
    select: { roleUserId: true },
  });
  const withLogin = new Set(users.map((u) => u.roleUserId));
  const out = list.map((s) => ({ ...s, hasLogin: withLogin.has(s.id) }));
  return Array.isArray(rows) ? out : out[0];
}

// Student-management actions that go beyond what an agent/counsellor can do to their own students
// (setting login passwords, deleting accounts) are admin-only — see middleware/access.js.

// A student gets exactly their own row back, an agent their own referrals (whatever `agentId`
// the query says — it can't widen the scope), internal staff everything (the counsellor portal
// needs every unclaimed lead, see counsellorStudentsStore.ts).
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { agentId, counsellorId } = req.query;
    const where = { ...studentWhere(req.authUser) };
    if (agentId && isInternal(req.authUser)) where.agentId = String(agentId);
    if (counsellorId && isInternal(req.authUser)) where.counsellorId = String(counsellorId);
    const students = await prisma.student.findMany({ where, orderBy: { createdAt: "asc" } });
    res.json(await attachHasLogin(students));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const student = await accessibleStudent(req.authUser, req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found." });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// Ownership (agentId/counsellorId) is derived from the caller's own identity, not the request
// body — an agent can only create students under themselves, same for a counsellor, so one role
// can never assign another's ownership by supplying a different id in the payload. The one
// exception is an admin (the Student Management page), who may assign either explicitly.
//
// `password` is optional: without it, this student has a Student record but no User row at all,
// so they have no way to ever log in (the pre-existing behavior). Passing one creates their login
// alongside their profile in the same transaction, so the person creating this account can hand
// them working credentials immediately instead of a dead-end "sign in" link.
router.post("/", requireAuth, requireStaff, async (req, res, next) => {
  try {
    const { name, email, phone, country, password, agentId, counsellorId } = req.body || {};
    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(country)) {
      return res.status(400).json({ error: "name, email and country are required." });
    }
    if (!EMAIL_RE.test(email.trim())) return res.status(400).json({ error: "Enter a valid email address." });
    if (password !== undefined && password !== null && password !== "" && (typeof password !== "string" || password.length < 8)) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({ error: "phone must be a string." });
    }

    const isAdmin = req.authUser.role === "admin";
    const count = await prisma.student.count();
    const studentData = {
      id: newStudentId(),
      name: name.trim(),
      email: normalizeEmail(email),
      phone: phone || undefined,
      country: country.trim(),
      agentId: req.authUser.role === "agent" ? req.authUser.roleUserId : isAdmin && agentId ? String(agentId) : undefined,
      counsellorId: req.authUser.role === "counsellor" ? req.authUser.roleUserId : isAdmin && counsellorId ? String(counsellorId) : undefined,
      avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
      riskFlag: "none",
    };

    const student = password
      ? await prisma.$transaction(async (tx) => {
          const created = await tx.student.create({ data: studentData });
          const passwordHash = await bcrypt.hash(password, 10);
          await tx.user.create({
            data: { email: studentData.email, passwordHash, name: studentData.name, role: "student", roleUserId: created.id },
          });
          return created;
        })
      : await prisma.student.create({ data: studentData });

    res.status(201).json({ ...student, hasLogin: Boolean(password) });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already registered." });
    next(err);
  }
});

// `password` is admin-only: it sets (or resets) the student's login, creating the User row if
// they never had one — the only way to fix a student who was registered without a password.
// Name/email edits are mirrored onto the User row so the login keeps matching the profile.
//
// Who may change what (matches what each role's UI offers):
//   student   → their own name / phone / country
//   agent     → their own students' name / phone / country / email
//   internal  → everything except password (admin only)
// The email is the login identity and is mirrored onto the User row, so letting any signed-in
// user change any student's email was an account-takeover path (sign in with Google as the new
// address) — hence agents can only touch their own students and students can't change it at all.
const STUDENT_EDITABLE = ["name", "phone", "country"];
const AGENT_EDITABLE = [...STUDENT_EDITABLE, "email"];

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const { name, email, phone, country, riskFlag, counsellorId, agentId, password } = body;
    if (password !== undefined && req.authUser.role !== "admin") {
      return res.status(403).json({ error: "Only an admin can set a student's password." });
    }
    if (!isInternal(req.authUser)) {
      const allowed = req.authUser.role === "agent" ? AGENT_EDITABLE : STUDENT_EDITABLE;
      const disallowed = Object.keys(body).filter((k) => body[k] !== undefined && !allowed.includes(k));
      if (disallowed.length) return res.status(403).json({ error: `You can't change ${disallowed.join(", ")}.` });
    }
    if (password !== undefined && password !== null && (typeof password !== "string" || password.length < 8)) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (riskFlag !== undefined && riskFlag !== null && !RISK_FLAGS.includes(riskFlag)) {
      return res.status(400).json({ error: `riskFlag must be one of: ${RISK_FLAGS.join(", ")}` });
    }
    for (const [key, value] of Object.entries({ name, email, phone, country, counsellorId, agentId })) {
      if (value !== undefined && value !== null && typeof value !== "string") {
        return res.status(400).json({ error: `${key} must be a string.` });
      }
    }
    if (name !== undefined && name !== null && !name.trim()) return res.status(400).json({ error: "name can't be empty." });
    if (email !== undefined && email !== null && !EMAIL_RE.test(email.trim())) return res.status(400).json({ error: "Enter a valid email address." });

    const existing = await accessibleStudent(req.authUser, req.params.id);
    if (!existing) return res.status(404).json({ error: "Student not found." });
    const nextEmail = email ? normalizeEmail(email) : undefined;

    const student = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id: req.params.id },
        data: {
          name: name?.trim(),
          email: nextEmail,
          phone,
          country: country?.trim(),
          riskFlag,
          counsellorId,
          agentId,
        },
      });

      const userPatch = {};
      if (name && name.trim() !== existing.name) userPatch.name = name.trim();
      if (nextEmail && nextEmail !== existing.email) userPatch.email = nextEmail;
      if (Object.keys(userPatch).length) {
        await tx.user.updateMany({ where: { roleUserId: existing.id, role: "student" }, data: userPatch });
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        const currentUser = await tx.user.findFirst({ where: { roleUserId: existing.id, role: "student" } });
        if (currentUser) {
          await tx.user.update({ where: { id: currentUser.id }, data: { passwordHash } });
        } else {
          await tx.user.create({
            data: {
              email: nextEmail || normalizeEmail(existing.email),
              passwordHash,
              name: name?.trim() || existing.name,
              role: "student",
              roleUserId: existing.id,
            },
          });
        }
      }

      return updated;
    });

    res.json(await attachHasLogin(student));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already registered." });
    next(err);
  }
});

// Removes a student account and everything hanging off it (profile, documents, comments,
// financial readiness, login). Refused while they still have applications — those carry
// commission, journey and audit history that shouldn't silently vanish with the student.
router.delete("/:id", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    const id = req.params.id;
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ error: "Student not found." });

    const applicationCount = await prisma.application.count({ where: { studentId: id } });
    if (applicationCount > 0) {
      return res.status(409).json({
        error: `This student has ${applicationCount} application${applicationCount === 1 ? "" : "s"} — withdraw or remove them before deleting the account.`,
      });
    }

    // Uploaded files are removed from disk only after the rows are gone — a failed transaction
    // must leave nothing half-deleted, and a stray file is far less harmful than a stray row.
    const documents = await prisma.document.findMany({ where: { studentId: id }, select: { fileUrl: true } });
    const loginUsers = await prisma.user.findMany({ where: { roleUserId: id, role: "student" }, select: { id: true } });
    const loginUserIds = loginUsers.map((u) => u.id);

    await prisma.$transaction(async (tx) => {
      // Re-checked inside the transaction so an application created between the count above and
      // here fails cleanly (409 via the P2003 mapping) instead of orphaning it.
      if (await tx.application.count({ where: { studentId: id } })) {
        throw Object.assign(new Error("This student has applications — withdraw or remove them before deleting the account."), { status: 409 });
      }
      await tx.task.deleteMany({ where: { OR: [{ assignedToId: id, assignedToRole: "student" }, { assignedById: id, assignedByRole: "student" }] } });
      await tx.task.updateMany({ where: { studentId: id }, data: { studentId: null } });
      await tx.meeting.updateMany({ where: { studentId: id }, data: { studentId: null } });
      await tx.studentComment.deleteMany({ where: { studentId: id } });
      await tx.document.deleteMany({ where: { studentId: id } });
      await tx.studentFinancialReadiness.deleteMany({ where: { studentId: id } });
      await tx.studentEnglishTest.deleteMany({ where: { studentId: id } });
      await tx.studentWorkExperience.deleteMany({ where: { studentId: id } });
      await tx.studentAcademicLevel.deleteMany({ where: { studentId: id } });
      await tx.studentProfile.deleteMany({ where: { studentId: id } });
      await tx.leadFollowUp.deleteMany({ where: { studentId: id } });
      await tx.profileStepCompletion.deleteMany({ where: { studentId: id } });
      await tx.shortlist.deleteMany({ where: { studentId: id } });
      await tx.notification.deleteMany({ where: { OR: [{ userId: id, userRole: "student" }, { studentId: id }] } });
      await tx.message.deleteMany({ where: { OR: [{ fromId: id, fromRole: "student" }, { toId: id, toRole: "student" }] } });
      if (loginUserIds.length) {
        await tx.interviewAnswer.deleteMany({ where: { session: { userId: { in: loginUserIds } } } });
        await tx.interviewSession.deleteMany({ where: { userId: { in: loginUserIds } } });
      }
      await tx.user.deleteMany({ where: { roleUserId: id, role: "student" } });
      await tx.student.delete({ where: { id } });
    });

    for (const d of documents) {
      const filePath = uploadedFilePath(d.fileUrl);
      if (filePath) fs.promises.unlink(filePath).catch(() => {});
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** Absolute path of an uploaded document from its public URL — only ever resolves inside the
 * uploads directory, whatever the stored value looks like. */
function uploadedFilePath(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/")) return null;
  const root = path.join(__dirname, "..", "..", "uploads");
  const resolved = path.resolve(root, "." + fileUrl.slice("/uploads".length));
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

// Self-service — a student connecting to an agent via a shared referral code, distinct from the
// unrestricted PATCH /:id above: only the student themselves may set their own agentId this way,
// and only by way of a real agent's code (never by supplying an id directly).
router.post("/:id/connect-agent", requireAuth, async (req, res, next) => {
  try {
    if (req.authUser.role !== "student" || req.authUser.roleUserId !== req.params.id) {
      return res.status(403).json({ error: "You can only connect your own account to an agent." });
    }
    const { code } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "A referral code is required." });
    }
    const agent = await prisma.staff.findFirst({ where: { referralCode: code.toUpperCase(), role: "agent" } });
    if (!agent) return res.status(404).json({ error: "Referral code not recognized." });

    const student = await prisma.student.update({ where: { id: req.params.id }, data: { agentId: agent.id } });
    res.json({ ...student, agentName: agent.name });
  } catch (err) {
    next(err);
  }
});

function actorFrom(req) {
  return { id: req.authUser.roleUserId, role: req.authUser.role, name: req.authUser.name };
}

function serializeComment(c) {
  return {
    id: c.id,
    studentId: c.studentId,
    notes: c.notes,
    timestamp: c.createdAt.toISOString(),
    performedBy: { id: c.performedById, role: c.performedByRole, name: c.performedByName },
  };
}

/** Student + their counsellor + their agent — a case-level comment thread isn't tied to one
 * application, so there's no responsibleCounsellorId/responsibleAdmissionOfficerId to draw on
 * (see applications.js's getApplicationParticipants for that per-application version); this is
 * everyone the Student record itself names. */
async function getStudentParticipants(student) {
  const staffIds = [student.counsellorId, student.agentId].filter(Boolean);
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

// Same access rule as GET /:id — a student their own case thread, an agent their own students',
// internal staff any.
router.get("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const student = await accessibleStudent(req.authUser, req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found." });
    const rows = await prisma.studentComment.findMany({
      where: { studentId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(serializeComment));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const { notes } = req.body || {};
    if (typeof notes !== "string" || !notes.trim()) {
      return res.status(400).json({ error: "notes is required." });
    }
    const student = await accessibleStudent(req.authUser, req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found." });
    const actor = actorFrom(req);

    const row = await prisma.studentComment.create({
      data: {
        studentId: req.params.id,
        notes,
        performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
      },
    });

    const participants = await getStudentParticipants(student);
    const recipients = participants.filter((p) => !(p.id === actor.id && p.role === actor.role));
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((p) => ({
          userId: p.id,
          userRole: p.role,
          type: "student_comment_added",
          title: `${actor.name} commented on ${student.name}'s case`,
          body: notes.slice(0, 280),
          studentId: student.id,
          activityId: row.id,
        })),
      });
      // Same fan-out as applications.js's comment_added — also lands as an individual message
      // from the poster to each other participant.
      await prisma.message.createMany({
        data: recipients.map((p) => ({
          id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${p.id}`,
          threadId: threadIdFor(actor, p),
          fromId: actor.id, fromRole: actor.role, fromName: actor.name,
          toId: p.id, toRole: p.role, toName: p.name,
          text: `[${student.name}'s case] ${notes}`,
        })),
      });
    }

    res.status(201).json(serializeComment(row));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
