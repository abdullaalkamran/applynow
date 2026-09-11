// Ad-hoc document requests a counsellor adds for a specific application — beyond the automatic
// core + university-derived checklist. Shows up as a real checklist item on both the counsellor's
// and the student's own Documents view, and is satisfied the same way any other item is: the
// student (or counsellor, on their behalf) uploads a file matching the requested type.

export interface CustomDocRequest {
  type: string;
  note?: string;
  requestedAt: string;
}

const STORAGE_PREFIX = "sd-custom-doc-requests:";

export function loadCustomDocRequests(applicationId: string): CustomDocRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + applicationId);
    return raw ? (JSON.parse(raw) as CustomDocRequest[]) : [];
  } catch {
    return [];
  }
}

function persist(applicationId: string, requests: CustomDocRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + applicationId, JSON.stringify(requests));
}

export function addCustomDocRequest(applicationId: string, type: string, note?: string) {
  const trimmed = type.trim();
  if (!trimmed) return;
  const existing = loadCustomDocRequests(applicationId);
  if (existing.some((r) => r.type.toLowerCase() === trimmed.toLowerCase())) return;
  persist(applicationId, [...existing, { type: trimmed, note: note?.trim() || undefined, requestedAt: new Date().toISOString().slice(0, 10) }]);
}

export function removeCustomDocRequest(applicationId: string, type: string) {
  persist(applicationId, loadCustomDocRequests(applicationId).filter((r) => r.type !== type));
}
