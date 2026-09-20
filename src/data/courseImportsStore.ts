// Client for Data Management's AI course-import queue (server/src/routes/courseImports.js).
// Plain async calls, deliberately NOT the warm-cache pattern the catalog stores use: the import
// page drives a sequential run loop, and a notifyCacheChange() would remount it (see
// utils/syncCache.ts) mid-batch. Only an approval touches the shared university cache — the
// caller refreshes that itself.
import { apiDelete, apiGet, apiPatch, apiPost } from "../utils/apiClient";
import type { University } from "../types";

export type CourseDraft = Omit<University["courses"][number], "id">;
export type CourseImportStatus = "queued" | "running" | "needs_review" | "approved" | "discarded" | "failed";
export type Confidence = "high" | "medium" | "low";
export type DraftFieldKey = keyof CourseDraft;

/** What courseExtraction.js hands back for one page: the draft plus everything a reviewer needs
 * to verify it — which fields to check, a verbatim quote from the page per key field, warnings. */
export interface ExtractionResult {
  course: CourseDraft;
  confidence: Partial<Record<DraftFieldKey, Confidence>>;
  needsAttention: DraftFieldKey[];
  warnings: string[];
  evidence: Partial<Record<DraftFieldKey, string>>;
  subjectGuess?: string;
  possibleDuplicateOf?: { id: string; name: string };
  meta: { provider: string; model: string; extractedAt: string; pageChars: number; textSource: "fetch" | "paste" };
}

export interface CourseImportItem {
  id: string;
  universityId: string;
  sourceUrl: string;
  status: CourseImportStatus;
  textSource?: "fetch" | "paste";
  hasPageText: boolean;
  pageTextPreview?: string;
  extracted?: ExtractionResult;
  error?: string;
  approvedCourseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseImportConfig {
  enabled: boolean;
  provider: string;
  providerReady: boolean;
}

// Rows the import page has seen, so the course form can open one instantly when navigated to
// from the queue (and fall back to a fetch on a cold reload).
const seen = new Map<string, CourseImportItem>();

export function rememberCourseImports(items: CourseImportItem[]) {
  for (const item of items) seen.set(item.id, item);
}

export function getCachedCourseImport(id: string): CourseImportItem | undefined {
  return seen.get(id);
}

export function fetchCourseImportConfig(): Promise<CourseImportConfig> {
  return apiGet<CourseImportConfig>("/api/course-imports/config");
}

export async function listCourseImports(universityId: string): Promise<CourseImportItem[]> {
  const items = await apiGet<CourseImportItem[]>(`/api/course-imports?universityId=${encodeURIComponent(universityId)}`);
  rememberCourseImports(items);
  return items;
}

export async function createCourseImports(universityId: string, urls: string[]): Promise<{ created: CourseImportItem[]; skipped: { url: string; reason: string }[] }> {
  const result = await apiPost<{ created: CourseImportItem[]; skipped: { url: string; reason: string }[] }>("/api/course-imports", { universityId, urls });
  rememberCourseImports(result.created);
  return result;
}

/** Fetch (or use `pageText`) and extract one row. Resolves to the row in `needs_review` or
 * `failed` — a page that couldn't be read is a normal outcome, not a thrown error. */
export async function runCourseImport(itemId: string, opts: { pageText?: string; refetch?: boolean } = {}): Promise<CourseImportItem> {
  const item = await apiPost<CourseImportItem>(`/api/course-imports/${itemId}/run`, opts);
  seen.set(item.id, item);
  return item;
}

export async function saveCourseImportDraft(itemId: string, course: Partial<CourseDraft>): Promise<CourseImportItem> {
  const item = await apiPatch<CourseImportItem>(`/api/course-imports/${itemId}`, { course });
  seen.set(item.id, item);
  return item;
}

/** The only way an import becomes a course. Caller should `refreshUniversities()` afterwards. */
export async function approveCourseImport(itemId: string, course: CourseDraft): Promise<{ item: CourseImportItem; course: University["courses"][number] }> {
  const result = await apiPost<{ item: CourseImportItem; course: University["courses"][number] }>(`/api/course-imports/${itemId}/approve`, { course });
  seen.set(result.item.id, result.item);
  return result;
}

export async function discardCourseImport(itemId: string): Promise<CourseImportItem> {
  const item = await apiPost<CourseImportItem>(`/api/course-imports/${itemId}/discard`);
  seen.set(item.id, item);
  return item;
}

export async function deleteCourseImport(itemId: string): Promise<void> {
  await apiDelete<void>(`/api/course-imports/${itemId}`);
  seen.delete(itemId);
}
