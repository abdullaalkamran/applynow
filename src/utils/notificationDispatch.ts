// Fires the WhatsApp/email notification for a status change — the frontend just gathers who
// should be told and what the change was; the backend decides (via the admin's per-status toggle)
// whether a message actually goes out, and renders/sends it. Fire-and-forget by design: a
// notification failing to send must never block or roll back the status update the counsellor/
// student/agent just made.
import { BACKEND_BASE } from "./backendBase";
import { STUDENTS, COUNSELLORS, AGENTS } from "../data/mockData";
import { loadPersonalInfo } from "../data/studentProfileDetailsStore";
import type { Application, AppStatus } from "../types";

const API_URL = `${BACKEND_BASE}/api/notifications/send`;

interface Recipient {
  channel: "whatsapp" | "email";
  to: string;
}

function recipientsFor(application: Application): Recipient[] {
  const student = STUDENTS.find((s) => s.id === application.studentId);
  if (!student) return [];

  // A student's phone can live on the base record (captured at signup, before onboarding — see
  // src/features/staff/counsellor/Leads.tsx's own call button) or on their Personal Information
  // onboarding record (OTP-verified, often the more current one for a student who's completed
  // it) — same fallback order used there, so this and the Leads page never disagree about it.
  const studentPhone = student.phone || loadPersonalInfo(student.id)?.phone;
  const studentContact = { email: student.email, phone: studentPhone };

  const contacts = [
    studentContact,
    student.counsellorId ? COUNSELLORS.find((c) => c.id === student.counsellorId) : undefined,
    student.agentId ? AGENTS.find((a) => a.id === student.agentId) : undefined,
  ].filter((c): c is NonNullable<typeof c> => !!c);

  const recipients: Recipient[] = [];
  for (const contact of contacts) {
    if (contact.phone) recipients.push({ channel: "whatsapp", to: contact.phone });
    if (contact.email) recipients.push({ channel: "email", to: contact.email });
  }
  return recipients;
}

export async function dispatchStatusNotification(application: Application, status: AppStatus, token?: string): Promise<void> {
  const recipients = recipientsFor(application);
  if (recipients.length === 0 || !token) return;

  const student = STUDENTS.find((s) => s.id === application.studentId);
  const variables = {
    studentName: student?.name ?? "there",
    university: application.university,
    course: application.course,
    status,
    nextAction: application.nextAction || "",
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, recipients, variables }),
    });
  } catch (err) {
    // Never block or surface this to the status-update flow — worst case, a message silently
    // didn't go out, which is far better than an application status update appearing to fail.
    console.warn("Status-change notification failed to send:", err);
  }
}
