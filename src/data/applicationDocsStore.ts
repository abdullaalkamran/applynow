export interface AppDoc { id: string; name: string; type: string; status: "pending"; uploadedAt: string; previewUrl?: string }

const STORAGE_PREFIX = "sd-app-docs:";

export function loadUploadedDocs(applicationId: string): AppDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${applicationId}`);
    return raw ? (JSON.parse(raw) as AppDoc[]) : [];
  } catch {
    return [];
  }
}

export function persistUploadedDocs(applicationId: string, docs: AppDoc[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${applicationId}`, JSON.stringify(docs));
}

function makeAppDoc(name: string, previewUrl?: string): AppDoc {
  return { id: `doc-${Date.now()}`, name, type: name, status: "pending", uploadedAt: new Date().toISOString().slice(0, 10), previewUrl };
}

/** Adds a newly uploaded document to an application's own list and persists it, returning the new list. */
export function addUploadedDoc(applicationId: string, name: string, previewUrl?: string): AppDoc[] {
  const next = [...loadUploadedDocs(applicationId), makeAppDoc(name, previewUrl)];
  persistUploadedDocs(applicationId, next);
  return next;
}
