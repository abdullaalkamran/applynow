// Postgres-backed via /api/documents (server/src/routes/documents.js, scope "application") — same
// synchronous-cache pattern as coreDocsStore.ts, and for the same reason: this used to be plain
// per-browser localStorage keyed only by applicationId, which meant a document an agent or student
// uploaded for an application was invisible to the counsellor's separate login — so there was
// nothing for a counsellor to view, let alone verify or reject.
import { apiGet, apiPostForm, apiPatch } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import { getAllApplications } from "./applicationsStore";
import { BACKEND_BASE } from "../utils/backendBase";

export interface AppDoc {
  id: string;
  name: string;
  type: string;
  status: string; // "uploaded" | "verified" | "rejected"
  uploadedAt: string; // date-only (YYYY-MM-DD), for display
  createdAt: string; // full ISO datetime — use this, not uploadedAt, to tell same-day uploads apart
  previewUrl?: string;
  rejectionReason?: string;
}

interface ServerDocument {
  id: string;
  studentId: string;
  applicationId?: string;
  scope: string;
  name: string;
  type: string;
  status: string;
  fileUrl?: string;
  custom?: boolean;
  rejectionReason?: string;
  createdAt: string;
}

/** Same reasoning as coreDocsStore.ts's resolveFileUrl — the server returns a relative path, not
 * an absolute host, so resolve it against this session's own BACKEND_BASE. */
function resolveFileUrl(fileUrl: string | undefined): string | undefined {
  if (!fileUrl) return undefined;
  return fileUrl.startsWith("/") ? `${BACKEND_BASE}${fileUrl}` : fileUrl;
}

function toAppDoc(d: ServerDocument): AppDoc {
  return { id: d.id, name: d.name, type: d.type, status: d.status, uploadedAt: d.createdAt.slice(0, 10), createdAt: d.createdAt, previewUrl: resolveFileUrl(d.fileUrl), rejectionReason: d.rejectionReason };
}

let cache: ServerDocument[] = [];

/** Every application's uploaded documents the caller's account can see — call once after login
 * (see utils/warmCaches.ts), same as every other migrated store. */
export async function refreshApplicationDocs(): Promise<void> {
  const next = await apiGet<ServerDocument[]>("/api/documents?scope=application");
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function loadUploadedDocs(applicationId: string): AppDoc[] {
  return cache.filter((d) => d.applicationId === applicationId).map(toAppDoc);
}

/** A real file upload — by the student themselves, or by a counsellor/agent uploading on their
 * behalf. Lands as "uploaded", awaiting the counsellor's review (see verifyAppDoc/rejectAppDoc).
 * The file is actually persisted server-side (multipart upload — see server/src/routes/documents.js),
 * not just turned into a local blob: URL, so every viewer (any account, any browser, after a
 * reload) can open it — a blob: URL only ever resolves in the tab that created it. */
export function addUploadedDoc(applicationId: string, name: string, file: File): AppDoc[] {
  const studentId = getAllApplications().find((a) => a.id === applicationId)?.studentId;
  if (!studentId) {
    console.warn(`addUploadedDoc: couldn't resolve a student for application "${applicationId}" — document not saved.`);
    return loadUploadedDocs(applicationId);
  }

  const optimisticId = `appdoc-${Date.now()}`;
  // A local blob: preview shows immediately, before the real upload round-trips — swapped for the
  // server's persisted URL once that resolves.
  const optimisticPreview = URL.createObjectURL(file);
  const optimistic: ServerDocument = {
    id: optimisticId, studentId, applicationId, scope: "application", name, type: name,
    status: "uploaded", fileUrl: optimisticPreview, createdAt: new Date().toISOString(),
  };
  cache = [...cache, optimistic];
  notifyCacheChange();

  const form = new FormData();
  form.append("studentId", studentId);
  form.append("applicationId", applicationId);
  form.append("scope", "application");
  form.append("name", name);
  form.append("type", name);
  form.append("file", file);
  apiPostForm<ServerDocument>("/api/documents", form)
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === optimisticId ? serverDoc : d));
      notifyCacheChange();
      URL.revokeObjectURL(optimisticPreview);
    })
    .catch((err) => console.warn("Failed to persist application document:", err));
  return loadUploadedDocs(applicationId);
}

/** Counsellor-only — approves an uploaded application document. */
export function verifyAppDoc(id: string): void {
  cache = cache.map((d) => (d.id === id ? { ...d, status: "verified" } : d));
  notifyCacheChange();
  apiPatch<ServerDocument>(`/api/documents/${id}`, { status: "verified" })
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === id ? serverDoc : d));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to verify application document:", err));
}

/** Counsellor-only — rejects an uploaded application document with a reason, which the student
 * then sees on the checklist prompting a re-upload. */
export function rejectAppDoc(id: string, reason: string): void {
  cache = cache.map((d) => (d.id === id ? { ...d, status: "rejected", rejectionReason: reason } : d));
  notifyCacheChange();
  apiPatch<ServerDocument>(`/api/documents/${id}`, { status: "rejected", rejectionReason: reason })
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === id ? serverDoc : d));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to reject application document:", err));
}
