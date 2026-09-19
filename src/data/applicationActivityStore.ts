// Postgres-backed via /api/applications/:id/activity (server/src/routes/applications.js) — an
// append-only, attributed audit log for one application. This used to be plain per-browser
// localStorage, which meant add_application_note (an AI write tool) only ever wrote to the
// calling counsellor's own browser — invisible to the student, the agent, or that same counsellor
// on a different device, and gone forever if local storage was ever cleared. Lazily fetched per
// application (like applicationJourneyStore.ts) rather than bulk-warmed, since activity volume is
// naturally per-application, and refreshed on the same poll/focus schedule as everything else
// (see refreshCachedActivity, wired into warmCaches.ts) so a note or event added elsewhere doesn't
// sit stale once this session has already looked at that application.
import { apiGet, apiPost } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
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
}

const cache: Record<string, ActivityEvent[]> = {};

function refreshFromServer(applicationId: string) {
  apiGet<ActivityEvent[]>(`/api/applications/${applicationId}/activity`)
    .then((next) => {
      if (!cacheChanged(next, cache[applicationId] ?? [])) return;
      cache[applicationId] = next;
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to load application activity:", err));
}

/** Newest first — how a "what changed since my last visit" or timeline UI wants it. Instant local
 * (empty, then swapped in) the first time an application is looked at. Unlike most other lazy
 * per-id stores here, this one re-fetches on *every* call, not just the first — a comment thread
 * is conversational (someone else's reply should show up the moment you open the tab, not up to
 * 12s later on the next background poll — see refreshCachedActivity for that slower path, which
 * still covers a tab left open in the background). cacheChanged() keeps this from causing extra
 * re-renders when nothing's actually new. */
export function loadActivityDescending(applicationId: string): ActivityEvent[] {
  if (!cache[applicationId]) cache[applicationId] = [];
  refreshFromServer(applicationId);
  return cache[applicationId];
}

/** Records a new client-originated activity event — add_application_note or the
 * request_document AI tool, in practice. Never call this for an event another route already
 * creates automatically alongside its own real effect (a status/stage change, a counsellor/
 * admission-officer assignment) — the server logs those itself; calling this too would just
 * double the entry. */
export function recordActivity(event: Omit<ActivityEvent, "id" | "timestamp">): ActivityEvent {
  const optimistic: ActivityEvent = {
    ...event,
    id: `act-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  };
  cache[event.applicationId] = [optimistic, ...(cache[event.applicationId] ?? [])];
  notifyCacheChange();

  apiPost<ActivityEvent>(`/api/applications/${event.applicationId}/activity`, {
    action: event.action,
    stageType: event.stageType,
    oldValue: event.oldValue,
    newValue: event.newValue,
    notes: event.notes,
  })
    .then((serverEvent) => {
      cache[event.applicationId] = cache[event.applicationId].map((e) => (e.id === optimistic.id ? serverEvent : e));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist application activity:", err));

  return optimistic;
}

/** Re-fetches every application's activity this session has already looked at — same reasoning as
 * applicationJourneyStore.ts's refreshCachedJourneys: a lazily-fetched, per-id cache is otherwise
 * never part of the periodic poll, so an event added from a different session would sit stale
 * indefinitely once this one had already loaded it. */
export function refreshCachedActivity(): void {
  Object.keys(cache).forEach((applicationId) => refreshFromServer(applicationId));
}
