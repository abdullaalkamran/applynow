// Postgres-backed via /api/documents (server/src/routes/documents.js, scope "core") — same
// synchronous-cache pattern as applicationsStore.ts/tasksStore.ts. This used to be plain
// per-browser localStorage, which meant a student's own upload was invisible to their counsellor
// and agent (different login, different browser) — the whole point of the core vault ("upload
// once, every application and every role sees it") only holds if it's actually shared, not local.
import { apiGet, apiPost, apiPostForm, apiPatch } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import { BACKEND_BASE } from "../utils/backendBase";

export interface CoreDoc {
  id: string;
  studentId: string;
  name: string;
  type: string;
  status: string; // "requested" | "uploaded" | "verified" | "rejected"
  uploadedAt: string; // date-only (YYYY-MM-DD), for display
  createdAt: string; // full ISO datetime — use this, not uploadedAt, to tell same-day uploads apart
  previewUrl?: string;
  custom?: boolean;
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

/** The server stores/returns a relative path (e.g. "/uploads/documents/xyz.pdf") since the same
 * DB row could in principle be read back through a different deployed frontend/backend pairing —
 * resolve it against this session's own BACKEND_BASE rather than baking an absolute host into the
 * stored value. Leaves an already-absolute URL (http(s):, or a transient local blob: preview)
 * untouched. */
function resolveFileUrl(fileUrl: string | undefined): string | undefined {
  if (!fileUrl) return undefined;
  return fileUrl.startsWith("/") ? `${BACKEND_BASE}${fileUrl}` : fileUrl;
}

function toCoreDoc(d: ServerDocument): CoreDoc {
  return {
    id: d.id, studentId: d.studentId, name: d.name, type: d.type, status: d.status,
    uploadedAt: d.createdAt.slice(0, 10), createdAt: d.createdAt, previewUrl: resolveFileUrl(d.fileUrl), custom: d.custom, rejectionReason: d.rejectionReason,
  };
}

let cache: CoreDoc[] = [];

/** Every student's core docs the caller's account can see — call once after login (see
 * utils/warmCaches.ts), same as every other migrated store. */
export async function refreshCoreDocs(): Promise<void> {
  const next = (await apiGet<ServerDocument[]>("/api/documents?scope=core")).map(toCoreDoc);
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

/** The student's core document vault — uploaded once, independent of any specific application. */
export function loadCoreDocs(studentId: string): CoreDoc[] {
  return cache.filter((d) => d.studentId === studentId);
}

/** A real file upload — by the student themselves, or by a counsellor/agent uploading on their
 * behalf. Lands as "uploaded", awaiting the counsellor's review (see verifyCoreDoc/rejectCoreDoc).
 * The file is actually persisted server-side (multipart upload — see server/src/routes/documents.js),
 * not just turned into a local blob: URL, so every viewer (any account, any browser, after a
 * reload) can open it — a blob: URL only ever resolves in the tab that created it. */
export function addCoreDoc(studentId: string, name: string, file: File): CoreDoc[] {
  const now = new Date().toISOString();
  // A local blob: preview shows immediately, before the real upload round-trips — swapped for the
  // server's persisted URL once that resolves.
  const optimisticPreview = URL.createObjectURL(file);
  const optimistic: CoreDoc = { id: `core-${Date.now()}`, studentId, name, type: name, status: "uploaded", uploadedAt: now.slice(0, 10), createdAt: now, previewUrl: optimisticPreview };
  cache = [...cache, optimistic];
  notifyCacheChange();

  const form = new FormData();
  form.append("studentId", studentId);
  form.append("scope", "core");
  form.append("name", name);
  form.append("type", name);
  form.append("file", file);
  apiPostForm<ServerDocument>("/api/documents", form)
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === optimistic.id ? toCoreDoc(serverDoc) : d));
      notifyCacheChange();
      URL.revokeObjectURL(optimisticPreview);
    })
    .catch((err) => console.warn("Failed to persist core document:", err));
  return cache.filter((d) => d.studentId === studentId);
}

/** A placeholder checklist slot with no file yet — the "Add a document type" picker uses this when
 * the student's academic profile is too incomplete for coreDocTypes() to have already listed the
 * exact type they actually need (e.g. "Bachelor's — Transcript" when no academic level is on file
 * yet). Shows up as a normal missing/upload row until something's actually filed against it. */
export function requestCoreDocType(studentId: string, type: string): void {
  const now = new Date().toISOString();
  const optimistic: CoreDoc = { id: `core-req-${Date.now()}`, studentId, name: type, type, status: "requested", uploadedAt: now.slice(0, 10), createdAt: now, custom: true };
  cache = [...cache, optimistic];
  notifyCacheChange();
  apiPost<ServerDocument>("/api/documents", { studentId, scope: "core", name: type, type, custom: true, status: "requested" })
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === optimistic.id ? toCoreDoc(serverDoc) : d));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to request core document type:", err));
}

/** Guarantees a core-doc slot of this type exists for the student, without ever duplicating or
 * regressing one that's already there (uploaded, verified, rejected, or already requested) — used
 * to auto-require a document the moment some event (e.g. a fresh application submission) first
 * makes it relevant. */
export function ensureCoreDocRequested(studentId: string, type: string): void {
  if (loadCoreDocs(studentId).some((d) => d.type === type)) return;
  requestCoreDocType(studentId, type);
}

/** Counsellor-only — approves an uploaded core document. */
export function verifyCoreDoc(id: string): void {
  cache = cache.map((d) => (d.id === id ? { ...d, status: "verified" } : d));
  notifyCacheChange();
  apiPatch<ServerDocument>(`/api/documents/${id}`, { status: "verified" })
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === id ? toCoreDoc(serverDoc) : d));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to verify core document:", err));
}

/** Counsellor-only — rejects an uploaded core document with a reason, which the student then sees
 * on the checklist prompting a re-upload. */
export function rejectCoreDoc(id: string, reason: string): void {
  cache = cache.map((d) => (d.id === id ? { ...d, status: "rejected", rejectionReason: reason } : d));
  notifyCacheChange();
  apiPatch<ServerDocument>(`/api/documents/${id}`, { status: "rejected", rejectionReason: reason })
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === id ? toCoreDoc(serverDoc) : d));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to reject core document:", err));
}
