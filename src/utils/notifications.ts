import { UNIVERSITIES, DOCUMENTS, CURRENT_STUDENT_ID } from "../data/mockData";
import { getAllApplications } from "../data/applicationsStore";
import { loadUploadedDocs } from "../data/applicationDocsStore";
import { buildChecklist, buildCoreChecklist } from "./documentChecklist";
import { MESSAGE_THREADS } from "../data/messageThreads";
import { loadReadIds } from "../data/notificationsStore";

export type NotificationType = "message" | "document" | "application";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  time: string;
  read: boolean;
  path: string;
  // Set on document items pointing at an application — opens straight to its Documents tab
  // instead of Overview, since that's the tab that actually shows what triggered the notification.
  state?: { tab: "Documents" };
}

function relativeTime(dateStr: string): string {
  const days = Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

/** Builds the notification feed from real, current app state — unread message threads, active
 * applications' latest status, and outstanding required documents — not placeholder content. */
export function getNotifications(): NotificationItem[] {
  const readIds = loadReadIds();
  const items: NotificationItem[] = [];

  MESSAGE_THREADS.forEach((t) => {
    items.push({
      id: `msg-${t.id}`,
      type: "message",
      title: t.name,
      detail: t.last,
      time: t.time,
      read: !t.unread || readIds.has(`msg-${t.id}`),
      path: t.ai ? "/student/counsellor" : "/student/messages",
    });
  });

  const applications = getAllApplications().filter(
    (a) => a.studentId === CURRENT_STUDENT_ID && !["Withdrawn", "Rejected", "Deferred"].includes(a.status)
  );

  applications.forEach((app) => {
    const id = `app-${app.id}`;
    items.push({
      id,
      type: "application",
      title: `${app.university} — ${app.status}`,
      detail: app.nextAction,
      time: relativeTime(app.updatedAt),
      read: readIds.has(id),
      path: `/student/applications/${app.id}`,
    });
  });

  const coreChecklist = buildCoreChecklist(CURRENT_STUDENT_ID);
  // A rejected core document gets its own, specific notification — the counsellor's reason
  // included — rather than being buried in the generic "documents needed" count below, which
  // looks identical whether nothing was ever uploaded or something was uploaded and turned down.
  coreChecklist
    .filter((r) => r.rejected)
    .forEach((r) => {
      const id = `doc-rejected-core-${r.rejected!.id}`;
      items.push({
        id,
        type: "document",
        title: `${r.type} rejected`,
        detail: r.rejected!.reason ? `Your counsellor rejected this: ${r.rejected!.reason}` : "Your counsellor rejected this document.",
        time: relativeTime(r.rejected!.uploadedAt),
        read: readIds.has(id),
        path: "/student/documents",
      });
    });

  const missingCore = coreChecklist.filter((r) => !r.own).length;
  if (missingCore > 0) {
    const id = "doc-core";
    items.push({
      id,
      type: "document",
      title: "Core documents needed",
      detail: `${missingCore} document${missingCore > 1 ? "s" : ""} still required before you can apply anywhere new.`,
      time: "",
      read: readIds.has(id),
      path: "/student/documents",
    });
  }

  applications.forEach((app) => {
    const university = UNIVERSITIES.find((u) => u.name === app.university);
    if (!university) return;
    const docs = [
      ...DOCUMENTS.filter((d) => d.studentId === CURRENT_STUDENT_ID && d.applicationId === app.id),
      ...loadUploadedDocs(app.id),
    ];
    const checklist = buildChecklist(university, app.studentId, app.id, docs);

    checklist
      .filter((r) => r.rejected)
      .forEach((r) => {
        const id = `doc-rejected-${app.id}-${r.rejected!.id}`;
        items.push({
          id,
          type: "document",
          title: `${r.type} rejected — ${app.university}`,
          detail: r.rejected!.reason ? `Your counsellor rejected this: ${r.rejected!.reason}` : "Your counsellor rejected this document.",
          time: relativeTime(r.rejected!.uploadedAt),
          read: readIds.has(id),
          path: `/student/applications/${app.id}`,
          state: { tab: "Documents" },
        });
      });

    const missing = checklist.filter((r) => !r.own && !r.reused).length;
    if (missing === 0) return;
    const id = `doc-${app.id}`;
    items.push({
      id,
      type: "document",
      title: `${missing} document${missing > 1 ? "s" : ""} needed for ${app.university}`,
      detail: `Upload the remaining requirements to keep this application moving.`,
      time: "",
      read: readIds.has(id),
      path: `/student/applications/${app.id}`,
      state: { tab: "Documents" },
    });
  });

  return items.sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1));
}

export function unreadNotificationCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}
