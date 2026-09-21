// Role and record-level access rules shared by every domain route. Before this module, routes
// were requireAuth-only: any signed-in user — and anyone can self-register as a student — could
// read or change any student, application, document, message thread or bank record by id.
//
// The rules mirror what each role's UI already shows, so a legitimate user sees no difference:
//   - student  → only their own Student record and everything hanging off it
//   - agent    → only the students they referred (Student.agentId) and those students' data
//   - internal → counsellor / admission / compliance / data / finance / admin keep full access
//                (the counsellor portal needs every unclaimed lead, admission needs every
//                submitted application, and so on — exactly as today)
// Student/agent misses answer 404, not 403, so a probe can't confirm that a record exists.
const prisma = require("../prismaClient");

const INTERNAL_ROLES = ["counsellor", "admission", "compliance", "data", "finance", "admin"];

function isInternal(authUser) {
  return INTERNAL_ROLES.includes(authUser?.role);
}

function requireRoles(...roles) {
  return function requireRolesMiddleware(req, res, next) {
    if (!roles.includes(req.authUser?.role)) return res.status(403).json({ error: "You don't have permission to do that." });
    next();
  };
}

/** Any signed-in non-student (agents included). */
function requireStaff(req, res, next) {
  if (!req.authUser || req.authUser.role === "student") return res.status(403).json({ error: "Staff access required." });
  next();
}

/** Counsellor / admission / compliance / data / finance / admin — not students, not agents. */
function requireInternal(req, res, next) {
  if (!isInternal(req.authUser)) return res.status(403).json({ error: "Staff access required." });
  next();
}

const requireDataRole = requireRoles("data", "admin");
const requireAdminRole = requireRoles("admin");

/** Prisma `where` fragment limiting a Student query to what the caller may see. */
function studentWhere(authUser) {
  if (authUser.role === "student") return { id: authUser.roleUserId };
  if (authUser.role === "agent") return { agentId: authUser.roleUserId };
  return {};
}

/** Same, for anything with a `studentId` + `student` relation (applications, documents…). */
function applicationWhere(authUser) {
  if (authUser.role === "student") return { studentId: authUser.roleUserId };
  if (authUser.role === "agent") return { student: { agentId: authUser.roleUserId } };
  return {};
}

/** The student row if the caller may access it, else null. */
async function accessibleStudent(authUser, studentId) {
  if (!studentId) return null;
  const student = await prisma.student.findUnique({ where: { id: String(studentId) } });
  if (!student) return null;
  if (authUser.role === "student") return student.id === authUser.roleUserId ? student : null;
  if (authUser.role === "agent") return student.agentId === authUser.roleUserId ? student : null;
  return student;
}

async function canAccessStudent(authUser, studentId) {
  return Boolean(await accessibleStudent(authUser, studentId));
}

/** The application row if the caller may access it, else null. */
async function accessibleApplication(authUser, applicationId) {
  if (!applicationId) return null;
  const app = await prisma.application.findUnique({ where: { id: String(applicationId) } });
  if (!app) return null;
  if (isInternal(authUser)) return app;
  if (authUser.role === "student") return app.studentId === authUser.roleUserId ? app : null;
  const student = await prisma.student.findUnique({ where: { id: app.studentId }, select: { agentId: true } });
  return student?.agentId === authUser.roleUserId ? app : null;
}

/** What a student or agent is allowed to know about a staff member — enough to render "your
 * counsellor is Maria" and an agent's name next to a referral, never contact details or the
 * agent's referral code. */
function publicStaff(row) {
  return { id: row.id, name: row.name, role: row.role, organization: row.organization ?? null, avatarColor: row.avatarColor };
}

module.exports = {
  INTERNAL_ROLES,
  isInternal,
  requireRoles,
  requireStaff,
  requireInternal,
  requireDataRole,
  requireAdminRole,
  studentWhere,
  applicationWhere,
  accessibleStudent,
  canAccessStudent,
  accessibleApplication,
  publicStaff,
};
