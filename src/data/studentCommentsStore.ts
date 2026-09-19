// Postgres-backed via /api/students/:id/comments (server/src/routes/students.js) — a shared,
// append-only comment thread on a student's overall case, not tied to one specific application
// (see applicationActivityStore.ts's "comment_added" activity for that). Replaces the old
// staffNotesStore.ts, a single localStorage string per student that any one save overwrote
// entirely and only the saving browser ever saw. Same lazy-per-id, always-refetch-on-read pattern
// as applicationActivityStore.ts — see that file's own comment for why a comment thread refetches
// on every read instead of only the first time.
import { apiGet, apiPost } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import type { Role } from "../types";

export interface StudentComment {
  id: string;
  studentId: string;
  notes: string;
  timestamp: string;
  performedBy: { id: string; role: Role; name: string };
}

const cache: Record<string, StudentComment[]> = {};

function refreshFromServer(studentId: string) {
  apiGet<StudentComment[]>(`/api/students/${studentId}/comments`)
    .then((next) => {
      if (!cacheChanged(next, cache[studentId] ?? [])) return;
      cache[studentId] = next;
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to load student comments:", err));
}

export function loadStudentComments(studentId: string): StudentComment[] {
  if (!cache[studentId]) cache[studentId] = [];
  refreshFromServer(studentId);
  return cache[studentId];
}

export function postStudentComment(studentId: string, notes: string, performedBy: StudentComment["performedBy"]): StudentComment {
  const optimistic: StudentComment = {
    id: `sc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    studentId,
    notes,
    timestamp: new Date().toISOString(),
    performedBy,
  };
  cache[studentId] = [optimistic, ...(cache[studentId] ?? [])];
  notifyCacheChange();

  apiPost<StudentComment>(`/api/students/${studentId}/comments`, { notes })
    .then((serverComment) => {
      cache[studentId] = cache[studentId].map((c) => (c.id === optimistic.id ? serverComment : c));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist student comment:", err));

  return optimistic;
}

export function refreshCachedStudentComments(): void {
  Object.keys(cache).forEach((studentId) => refreshFromServer(studentId));
}
