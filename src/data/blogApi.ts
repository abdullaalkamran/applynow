// News & Updates posts. Editors (Data Management / admin) use the authenticated /api/blog routes; the logged-out landing
// page and /news pages use the public ones — plain fetch with no auth header, since there's no session there.
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { BACKEND_BASE } from "../utils/backendBase";

export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  status: BlogStatus;
  authorName: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogInput {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  status: BlogStatus;
}

export const listPosts = () => apiGet<BlogPost[]>("/api/blog");
export const getPost = (id: string) => apiGet<BlogPost>(`/api/blog/${encodeURIComponent(id)}`);
export const createPost = (input: BlogInput) => apiPost<BlogPost>("/api/blog", input);
export const updatePost = (id: string, patch: Partial<BlogInput>) => apiPatch<BlogPost>(`/api/blog/${encodeURIComponent(id)}`, patch);
export const deletePost = (id: string) => apiDelete<void>(`/api/blog/${encodeURIComponent(id)}`);

// ---- public (no login) ----
export interface PublicNewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl?: string;
  authorName: string;
  publishedAt?: string;
}
export interface PublicNewsPost extends PublicNewsItem { content: string }

async function publicGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BACKEND_BASE}${path}`, { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error((data as { error?: string }).error || `Request failed (${response.status})`), { status: response.status });
  return data as T;
}

export const fetchPublicNews = (signal?: AbortSignal) => publicGet<PublicNewsItem[]>("/api/public/news", signal);
export const fetchPublicNewsPost = (slug: string, signal?: AbortSignal) => publicGet<PublicNewsPost>(`/api/public/news/${encodeURIComponent(slug)}`, signal);

/** Cover/photo URLs from the server are root-relative (/uploads/…) — prefix the API host when it differs. */
export function mediaSrc(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${BACKEND_BASE}${url}` : url;
}

export function formatPostDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";
}
