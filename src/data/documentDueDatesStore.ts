// Optional due dates a counsellor can set on any checklist document type for a given
// application — works uniformly whether the document is automatically required (core/university
// derived) or a custom request, since it's keyed only by (applicationId, type).

const STORAGE_PREFIX = "sd-doc-due-dates:";

function loadMap(applicationId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + applicationId);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveMap(applicationId: string, map: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + applicationId, JSON.stringify(map));
}

export function loadDocDueDate(applicationId: string, type: string): string | undefined {
  return loadMap(applicationId)[type];
}

export function setDocDueDate(applicationId: string, type: string, dueDate: string) {
  const map = loadMap(applicationId);
  if (dueDate) {
    map[type] = dueDate;
  } else {
    delete map[type];
  }
  saveMap(applicationId, map);
}

/** "Overdue" / "Due soon" / "On track" classification for showing urgency. */
export function dueDateTone(dueDate: string | undefined): "overdue" | "soon" | "normal" | "none" {
  if (!dueDate) return "none";
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "normal";
}
