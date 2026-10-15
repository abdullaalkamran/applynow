// Client for the external-portal automation API (server/src/routes/portals.js). Deliberately not a cached store —
// connections and submissions are only read by the Portals page and the AI agent's tools, and credentials are
// write-only: the server never returns them, so there is nothing sensitive to hold here.
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { BACKEND_BASE } from "../utils/backendBase";

export interface PortalConnection {
  id: string;
  name: string;
  url: string;
  kind: "b2b" | "university";
  universityId?: string;
  lastLoginOk?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export type SubmissionStatus = "queued" | "preparing" | "awaiting_confirm" | "submitted" | "needs_human" | "failed";

export interface PortalSubmission {
  id: string;
  applicationId: string;
  portalConnectionId: string;
  status: SubmissionStatus;
  externalRef?: string;
  submittedAt?: string;
  lastCheckedAt?: string;
  lastError?: string;
  portalStatus?: string;
  updatedAt: string;
}

export const listPortals = () => apiGet<PortalConnection[]>("/api/portals");
export const addPortal = (input: { name: string; url: string; kind: "b2b" | "university"; username: string; password: string }) =>
  apiPost<PortalConnection>("/api/portals", input);
export const updatePortal = (id: string, patch: { name?: string; url?: string; username?: string; password?: string }) =>
  apiPatch<PortalConnection>(`/api/portals/${id}`, patch);
export const removePortal = (id: string) => apiDelete<void>(`/api/portals/${id}`);

export const listSubmissions = (applicationId?: string) =>
  apiGet<PortalSubmission[]>(`/api/portals/submissions${applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : ""}`);
export const queueSubmission = (portalId: string, applicationId: string) =>
  apiPost<PortalSubmission>(`/api/portals/${portalId}/submissions`, { applicationId });
export const confirmSubmission = (submissionId: string) => apiPost<{ ok: true }>(`/api/portals/submissions/${submissionId}/confirm`);

/** The worker's pre-submit screenshot, fetched with the session token (it's behind auth) as a blob URL. */
export async function fetchSubmissionPreview(submissionId: string): Promise<string | null> {
  const token = window.localStorage.getItem("sd-auth-token") ?? "";
  const res = await fetch(`${BACKEND_BASE}/api/portals/submissions/${submissionId}/preview`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return res.ok ? URL.createObjectURL(await res.blob()) : null;
}
