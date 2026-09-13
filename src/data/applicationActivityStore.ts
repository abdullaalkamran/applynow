// An append-only, attributed audit log for one application — genuinely new. Neither
// staffNotesStore.ts (a single overwritable string per student, no author/timestamp) nor
// applicationsStore.getStatusHistory() (bare {status,changedAt}, no actor) is an activity feed.
// This is what backs both add_application_note (an AI write tool) and "what changed since my last
// visit" for a human reading the application.
import type { Role } from "../types";
import type { StageType } from "../types/journey";

export interface ActivityEvent {
  id: string;
  applicationId: string;
  timestamp: string; // ISO datetime
  stageType?: StageType;
  action: string; // e.g. "status_changed", "stage_updated", "note_added", "document_requested"
  oldValue?: unknown;
  newValue?: unknown;
  performedBy: { id: string; role: Role; name: string };
  notes?: string;
  metadata?: Record<string, unknown>;
}

const STORAGE_PREFIX = "sd-application-activity:";

export function loadActivity(applicationId: string): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + applicationId);
    return raw ? (JSON.parse(raw) as ActivityEvent[]) : [];
  } catch {
    return [];
  }
}

function persist(applicationId: string, events: ActivityEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + applicationId, JSON.stringify(events));
}

export function recordActivity(event: Omit<ActivityEvent, "id" | "timestamp">): ActivityEvent {
  const full: ActivityEvent = {
    ...event,
    id: `act-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  };
  persist(event.applicationId, [...loadActivity(event.applicationId), full]);
  return full;
}

/** Newest first — how a "what changed since my last visit" or timeline UI wants it. */
export function loadActivityDescending(applicationId: string): ActivityEvent[] {
  return [...loadActivity(applicationId)].reverse();
}
