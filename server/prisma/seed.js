// One-time seed, hand-ported from src/data/mockData.ts + src/data/tasksStore.ts +
// server/src/usersStore.js — preserves every existing seed id ("s1", "a1", "c1", "app1", ...)
// exactly, since dozens of not-yet-migrated frontend stores/constants reference these ids by
// string literal (see the migration plan's "Seed ids stay as literal strings" note).
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { buildInitialStages } = require("../src/journeyLogic");

const prisma = new PrismaClient();

const SEED_PASSWORD = "password123";

const STUDENTS = [
  { id: "s1", name: "Sarah Khan", email: "sarah.khan@email.com", country: "Bangladesh", agentId: "a1", counsellorId: "c1", avatarColor: "bg-rose-500", riskFlag: "none" },
  { id: "s2", name: "Tomiwa Adeyemi", email: "tomiwa.a@example.com", country: "Nigeria", agentId: "a1", counsellorId: "c1", avatarColor: "bg-amber-500", riskFlag: "watch" },
  { id: "s3", name: "Priya Nair", email: "priya.n@example.com", country: "India", agentId: "a2", counsellorId: "c1", avatarColor: "bg-emerald-500", riskFlag: "none" },
  { id: "s4", name: "Duy Nguyen", email: "duy.n@example.com", country: "Vietnam", agentId: "a2", counsellorId: "c2", avatarColor: "bg-sky-500", riskFlag: "high" },
  { id: "s5", name: "Fatima Al-Sayed", email: "fatima.a@example.com", country: "Egypt", agentId: "a1", counsellorId: "c2", avatarColor: "bg-violet-500", riskFlag: "none" },
  { id: "s6", name: "Amara Chukwu", email: "amara.chukwu@example.com", phone: "+234 803 555 0142", country: "Nigeria", counsellorId: "c1", avatarColor: "bg-indigo-500", riskFlag: "none" },
  { id: "s7", name: "Carlos Mendes", email: "carlos.mendes@example.com", phone: "+55 11 98765 4321", country: "Brazil", counsellorId: "c1", avatarColor: "bg-teal-500", riskFlag: "none" },
  { id: "s8", name: "Grace Mensah", email: "grace.mensah@example.com", phone: "+233 24 555 0198", country: "Ghana", agentId: "a2", avatarColor: "bg-rose-400", riskFlag: "none" },
  { id: "s9", name: "Youssef Ibrahim", email: "youssef.ibrahim@example.com", phone: "+20 100 555 0176", country: "Egypt", agentId: "a1", avatarColor: "bg-sky-400", riskFlag: "none" },
  { id: "s10", name: "Ana Torres", email: "ana.torres@example.com", phone: "+52 55 5555 0163", country: "Mexico", counsellorId: "c1", avatarColor: "bg-emerald-400", riskFlag: "none" },
  { id: "s11", name: "Rafid Tajwar", email: "rafid.tajwar@example.com", phone: "+880 1812-345678", country: "Bangladesh", agentId: "a1", avatarColor: "bg-sky-500", riskFlag: "none" },
  { id: "s12", name: "Meher Nabila", email: "meher.nabila@example.com", phone: "+880 1912-987654", country: "Bangladesh", agentId: "a1", avatarColor: "bg-rose-400", riskFlag: "none" },
];

const STAFF = [
  { id: "c1", name: "Maria Fernandez", email: "maria.fernandez@studyone.dev", role: "counsellor", phone: "+44 7700 900123", avatarColor: "bg-sky-500" },
  { id: "c2", name: "David Osei", email: "david.osei@studyone.dev", role: "counsellor", phone: "+44 7700 900456", avatarColor: "bg-emerald-500" },
  { id: "a1", name: "Rafiq Hossain", email: "rafiq.hossain@globalpathways.example", role: "agent", organization: "Global Pathways Consultants", phone: "+880 1811-223344", avatarColor: "bg-amber-500" },
  { id: "a2", name: "Nusrat Jahan", email: "nusrat.jahan@brightfuture.example", role: "agent", organization: "BrightFuture Education", phone: "+880 1911-556677", avatarColor: "bg-violet-500" },
  { id: "ad1", name: "Aisha Rahman", email: "aisha.rahman@studyone.dev", role: "admission", phone: "+44 7700 900654", avatarColor: "bg-indigo-500" },
  { id: "ad2", name: "Tanvir Ahmed", email: "tanvir.ahmed@studyone.dev", role: "admission", phone: "+44 7700 900321", avatarColor: "bg-sky-600" },
  { id: "ad3", name: "Priya Sharma", email: "priya.sharma@studyone.dev", role: "admission", phone: "+44 7700 900432", avatarColor: "bg-violet-600" },
  { id: "co1", name: "R. Fernandez", email: "r.fernandez@studyone.dev", role: "compliance", phone: "+44 7700 900987", avatarColor: "bg-rose-500" },
];

// Demo applications intentionally removed from the seed — the catalog/application data starts
// empty now; real applications are created through the app once real universities exist.
const APPLICATIONS = [];

const RAFIQ = { id: "a1", role: "agent", name: "Rafiq Hossain" };
const MARIA = { id: "c1", role: "counsellor", name: "Maria Fernandez" };
const ADMIN_PERSON = { id: "admin", role: "admin", name: "Admin" };

const TASKS = [
  { id: "t1", title: "Follow up on updated IELTS score", assignedTo: RAFIQ, assignedBy: RAFIQ, dueDate: "2026-09-12", createdAt: "2026-09-01T09:00:00.000Z", studentId: "s2", studentName: "Tomiwa Adeyemi" },
  { id: "t2", title: "Share intake options for MSc programs", assignedTo: RAFIQ, assignedBy: RAFIQ, dueDate: "2026-09-13", createdAt: "2026-09-01T09:00:00.000Z", studentId: "s11", studentName: "Rafid Tajwar" },
  { id: "t3", title: "Confirm deposit receipt with university", assignedTo: RAFIQ, assignedBy: RAFIQ, dueDate: "2026-09-15", createdAt: "2026-09-01T09:00:00.000Z", studentId: "s5", studentName: "Fatima Al-Sayed" },
  { id: "t4", title: "Register interest and open a case", assignedTo: RAFIQ, assignedBy: RAFIQ, dueDate: "2026-09-16", createdAt: "2026-09-01T09:00:00.000Z", studentId: "s12", studentName: "Meher Nabila" },
  { id: "t5", title: "Prep visa document pack before CAS is issued", assignedTo: RAFIQ, assignedBy: MARIA, dueDate: "2026-09-18", createdAt: "2026-09-05T09:00:00.000Z", studentId: "s1", studentName: "Sarah Khan" },
  { id: "t6", title: "Review this quarter's commission approvals before Friday", assignedTo: MARIA, assignedBy: ADMIN_PERSON, dueDate: "2026-09-19", createdAt: "2026-09-06T09:00:00.000Z" },
];

// role -> roleUserId. admission/compliance/data/finance/admin are NOT tied to a specific Staff row
// today (matches server/src/usersStore.js's existing SEED_USERS exactly) — preserved as-is rather
// than "fixed", since that's a pre-existing property of the app, not something this migration changes.
const USERS = [
  { email: "student@studyone.dev", name: "Sarah Khan", role: "student", roleUserId: "s1" },
  { email: "agent@studyone.dev", name: "Rafiq Hossain", role: "agent", roleUserId: "a1" },
  { email: "counsellor@studyone.dev", name: "Maria Fernandez", role: "counsellor", roleUserId: "c1" },
  { email: "admission@studyone.dev", name: "Aisha Rahman", role: "admission", roleUserId: "admission" },
  { email: "compliance@studyone.dev", name: "R. Fernandez", role: "compliance", roleUserId: "compliance" },
  { email: "data@studyone.dev", name: "Data Management", role: "data", roleUserId: "data" },
  { email: "finance@studyone.dev", name: "Finance", role: "finance", roleUserId: "finance" },
  { email: "admin@studyone.dev", name: "Admin", role: "admin", roleUserId: "admin" },
];

async function main() {
  console.log("Seeding StudyOne Postgres database...");

  for (const s of STAFF) {
    await prisma.staff.upsert({ where: { id: s.id }, update: s, create: s });
  }
  for (const s of STUDENTS) {
    await prisma.student.upsert({ where: { id: s.id }, update: s, create: s });
  }
  for (const a of APPLICATIONS) {
    // updatedAt is `@updatedAt` in the schema (Prisma manages it), so the mock data's plain
    // "YYYY-MM-DD" string is dropped rather than passed through — it isn't a valid DateTime anyway.
    const { id, updatedAt: _updatedAt, ...rest } = a;
    await prisma.application.upsert({ where: { id }, update: rest, create: { id, ...rest } });
    await prisma.applicationJourney.upsert({
      where: { applicationId: id },
      update: {},
      create: { applicationId: id, stages: buildInitialStages(a.country) },
    });
  }
  for (const t of TASKS) {
    const { id, assignedTo, assignedBy, ...rest } = t;
    const data = {
      ...rest,
      assignedToId: assignedTo.id, assignedToRole: assignedTo.role, assignedToName: assignedTo.name,
      assignedById: assignedBy.id, assignedByRole: assignedBy.role, assignedByName: assignedBy.name,
      dueDate: rest.dueDate ? new Date(rest.dueDate) : null,
    };
    await prisma.task.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  const passwordHash = bcrypt.hashSync(SEED_PASSWORD, 10);
  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    const id = `u${i + 1}`;
    await prisma.user.upsert({
      where: { email: u.email },
      update: { ...u, passwordHash },
      create: { id, ...u, passwordHash },
    });
  }

  console.log("Seeded:", STAFF.length, "staff,", STUDENTS.length, "students,", APPLICATIONS.length, "applications,", TASKS.length, "tasks,", USERS.length, "users.");
  console.log(`Login password for every seeded account: "${SEED_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
