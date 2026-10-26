// In-app inbox rows (the Notification model) for everyone tied to a student's case: the student, their
// counsellor and agent, and — when an application is involved — its responsible counsellor and admission
// officer. The person who did the thing is never notified about their own action.
const prisma = require("./prismaClient");

async function notifyStudentCircle({ studentId, application, actor, type, title, body }) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return;
  const staffIds = [student.counsellorId, student.agentId, application?.responsibleCounsellorId, application?.responsibleAdmissionOfficerId].filter(Boolean);
  const staff = staffIds.length ? await prisma.staff.findMany({ where: { id: { in: [...new Set(staffIds)] } } }) : [];
  const seen = new Set();
  const people = [{ id: student.id, role: "student" }, ...staff.map((s) => ({ id: s.id, role: s.role }))].filter((p) => {
    const key = `${p.role}:${p.id}`;
    if (seen.has(key) || (actor && p.id === actor.id && p.role === actor.role)) return false;
    seen.add(key);
    return true;
  });
  if (people.length === 0) return;
  await prisma.notification.createMany({
    data: people.map((p) => ({
      userId: p.id, userRole: p.role, type, title: String(title).slice(0, 190), body: body ? String(body).slice(0, 280) : undefined,
      studentId, applicationId: application?.id,
    })),
  });
}

/** Fire-and-forget wrapper — never let a notification failure affect the request that triggered it. */
function notifyInBackground(args) {
  notifyStudentCircle(args).catch((err) => console.warn("In-app notification failed:", err));
}

module.exports = { notifyStudentCircle, notifyInBackground };
