// Postgres-backed via /api/documents (server/src/routes/documents.js, scope "application") — same
// synchronous-cache pattern as coreDocsStore.ts, and for the same reason: this used to be plain
// per-browser localStorage keyed only by applicationId, which meant a document an agent or student
// uploaded for an application was invisible to the counsellor's separate login — so there was
// nothing for a counsellor to view, let alone verify or reject.
import { apiGet, apiPost, apiPostForm, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import { getAllApplications } from "./applicationsStore";
import { BACKEND_BASE } from "../utils/backendBase";

export interface AppDoc {
  id: string;
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
  note?: string;
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
  return { id: d.id, name: d.name, type: d.type, status: d.status, uploadedAt: d.createdAt.slice(0, 10), createdAt: d.createdAt, previewUrl: resolveFileUrl(d.fileUrl), custom: d.custom, rejectionReason: d.rejectionReason };
}

let cache: ServerDocument[] = [];
let refreshSeq = 0;

/** Every application's uploaded documents the caller's account can see — call once after login
 * (see utils/warmCaches.ts), same as every other migrated store. */
export async function refreshApplicationDocs(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<ServerDocument[]>("/api/documents?scope=application");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
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
  const prev = cache;
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
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist application document:", err);
    });
  return loadUploadedDocs(applicationId);
}

/** Counsellor-only — approves an uploaded application document. */
export function verifyAppDoc(id: string): void {
  const prev = cache;
  cache = cache.map((d) => (d.id === id ? { ...d, status: "verified" } : d));
  notifyCacheChange();
  apiPatch<ServerDocument>(`/api/documents/${id}`, { status: "verified" })
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === id ? serverDoc : d));
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to verify application document:", err);
    });
}

/** Counsellor-only — rejects an uploaded application document with a reason, which the student
 * then sees on the checklist prompting a re-upload. */
export function rejectAppDoc(id: string, reason: string): void {
  const prev = cache;
  cache = cache.map((d) => (d.id === id ? { ...d, status: "rejected", rejectionReason: reason } : d));
  notifyCacheChange();
  apiPatch<ServerDocument>(`/api/documents/${id}`, { status: "rejected", rejectionReason: reason })
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === id ? serverDoc : d));
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to reject application document:", err);
    });
}

// Ad-hoc document requests a counsellor adds for a specific application, beyond the automatic
// core + university-derived checklist — modelled as the same Document row as a real upload
// (custom: true, status "requested", no file yet), so they share this store's cache instead of a
// separate localStorage-only one. That used to mean a counsellor's request only ever existed in
// their own browser — invisible to the student and agent who needed to act on it, and with no
// notification firing (see server route's POST handler for that half of the fix).

export interface CustomDocRequest {
  id: string;
  type: string;
  note?: string;
  requestedAt: string; // date-only (YYYY-MM-DD)
}

function toCustomDocRequest(d: ServerDocument): CustomDocRequest {
  return { id: d.id, type: d.type, note: d.note, requestedAt: d.createdAt.slice(0, 10) };
}

export function loadCustomDocRequests(applicationId: string): CustomDocRequest[] {
  return cache.filter((d) => d.applicationId === applicationId && d.custom && d.status === "requested").map(toCustomDocRequest);
}

export function addCustomDocRequest(applicationId: string, type: string, note?: string): void {
  const trimmed = type.trim();
  if (!trimmed) return;
  if (cache.some((d) => d.applicationId === applicationId && d.custom && d.status === "requested" && d.type.toLowerCase() === trimmed.toLowerCase())) return;
  const studentId = getAllApplications().find((a) => a.id === applicationId)?.studentId;
  if (!studentId) {
    console.warn(`addCustomDocRequest: couldn't resolve a student for application "${applicationId}" — request not saved.`);
    return;
  }

  const optimisticId = `custom-req-${Date.now()}`;
  const optimistic: ServerDocument = {
    id: optimisticId, studentId, applicationId, scope: "application", name: trimmed, type: trimmed,
    status: "requested", custom: true, note: note?.trim() || undefined, createdAt: new Date().toISOString(),
  };
  const prev = cache;
  cache = [...cache, optimistic];
  notifyCacheChange();

  apiPost<ServerDocument>("/api/documents", {
    studentId, applicationId, scope: "application", name: trimmed, type: trimmed, custom: true, status: "requested", note: note?.trim(),
  })
    .then((serverDoc) => {
      cache = cache.map((d) => (d.id === optimisticId ? serverDoc : d));
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist document request:", err);
    });
}

/** Withdraws a request before anything's been uploaded against it. */
export function removeCustomDocRequest(applicationId: string, type: string): void {
  const match = cache.find((d) => d.applicationId === applicationId && d.custom && d.status === "requested" && d.type === type);
  if (!match) return;
  const prev = cache;
  cache = cache.filter((d) => d.id !== match.id);
  notifyCacheChange();
  apiDelete(`/api/documents/${match.id}`).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to remove document request:", err);
    });
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearApplicationDocsCache() {
  cache = [];
}
