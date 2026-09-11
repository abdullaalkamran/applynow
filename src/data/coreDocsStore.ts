export interface CoreDoc { id: string; name: string; type: string; status: "pending"; uploadedAt: string; previewUrl?: string }

const STORAGE_KEY = "sd-core-docs";

// The student's core document vault — uploaded once, independent of any specific application.
export function loadCoreDocs(): CoreDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CoreDoc[]) : [];
  } catch {
    return [];
  }
}

export function addCoreDoc(name: string, previewUrl?: string): CoreDoc[] {
  const doc: CoreDoc = { id: `core-${Date.now()}`, name, type: name, status: "pending", uploadedAt: new Date().toISOString().slice(0, 10), previewUrl };
  const next = [...loadCoreDocs(), doc];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
