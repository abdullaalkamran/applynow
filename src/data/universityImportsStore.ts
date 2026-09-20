// Client for the AI university-import queue (server/src/routes/universityImports.js) — the
// university-level twin of courseImportsStore.ts, with the same "plain async calls, no shared
// cache tick" rationale (see that file). Only an approval touches the catalog cache; the caller
// refreshes it.
import { apiDelete, apiGet, apiPatch, apiPost } from "../utils/apiClient";
import type { University } from "../types";
import type { Confidence, CourseImportStatus } from "./courseImportsStore";

export type UniversityDraft = Omit<University, "id">;
export type UniversityFieldKey = keyof UniversityDraft;

export interface UniversityExtractionResult {
  university: UniversityDraft;
  confidence: Partial<Record<UniversityFieldKey, Confidence>>;
  needsAttention: UniversityFieldKey[];
  warnings: string[];
  evidence: Partial<Record<UniversityFieldKey, string>>;
  possibleDuplicateOf?: { id: string; name: string };
  meta: { provider: string; model: string; extractedAt: string; pageChars: number; textSource: "fetch" | "paste" };
}

export interface UniversityImportItem {
  id: string;
  sourceUrl: string;
  extraUrls?: string[];
  status: CourseImportStatus;
  countryHint?: string;
  textSource?: "fetch" | "paste";
  hasPageText: boolean;
  pageTextPreview?: string;
  extracted?: UniversityExtractionResult;
  error?: string;
  approvedUniversityId?: string;
  createdAt: string;
  updatedAt: string;
}

const seen = new Map<string, UniversityImportItem>();

export function getCachedUniversityImport(id: string): UniversityImportItem | undefined {
  return seen.get(id);
}

export async function listUniversityImports(): Promise<UniversityImportItem[]> {
  const items = await apiGet<UniversityImportItem[]>("/api/university-imports");
  for (const item of items) seen.set(item.id, item);
  return items;
}

export async function createUniversityImports(urls: string[], country?: string): Promise<{ created: UniversityImportItem[]; skipped: { url: string; reason: string }[] }> {
  const result = await apiPost<{ created: UniversityImportItem[]; skipped: { url: string; reason: string }[] }>("/api/university-imports", { urls, country: country || undefined });
  for (const item of result.created) seen.set(item.id, item);
  return result;
}

/** `subjects` / `countries` are the frontend's own registries (fields.ts, countryRegistry.ts) —
 * the server has no copy, and the model must use those names verbatim. */
export async function runUniversityImport(
  itemId: string,
  opts: { pageText?: string; refetch?: boolean; subjects: string[]; countries: string[] }
): Promise<UniversityImportItem> {
  const item = await apiPost<UniversityImportItem>(`/api/university-imports/${itemId}/run`, opts);
  seen.set(item.id, item);
  return item;
}

export async function saveUniversityImportDraft(itemId: string, university: Partial<UniversityDraft>): Promise<UniversityImportItem> {
  const item = await apiPatch<UniversityImportItem>(`/api/university-imports/${itemId}`, { university });
  seen.set(item.id, item);
  return item;
}

/** The only way an import becomes a university. Caller should `refreshUniversities()` afterwards. */
export async function approveUniversityImport(itemId: string, university: UniversityDraft): Promise<{ item: UniversityImportItem; university: University }> {
  const result = await apiPost<{ item: UniversityImportItem; university: University }>(`/api/university-imports/${itemId}/approve`, { university });
  seen.set(result.item.id, result.item);
  return result;
}

export async function discardUniversityImport(itemId: string): Promise<UniversityImportItem> {
  const item = await apiPost<UniversityImportItem>(`/api/university-imports/${itemId}/discard`);
  seen.set(item.id, item);
  return item;
}

export async function deleteUniversityImport(itemId: string): Promise<void> {
  await apiDelete<void>(`/api/university-imports/${itemId}`);
  seen.delete(itemId);
}
