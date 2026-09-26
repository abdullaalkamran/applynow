import { apiGet, apiPost } from "../utils/apiClient";
import type { AuthUser } from "../utils/authClient";

export interface AgentInviteSummary {
  name: string;
  email: string;
  organization: string | null;
}

export interface AgentInviteCreated extends AgentInviteSummary {
  expiresAt: string;
  acceptUrl: string;
}

/** Admin-only — see server/src/routes/agentInvites.js's POST /. Agent is the one role with no
 * admin-direct account creation (unlike inviteStaff in staffStore.ts), so this creates a pending
 * invite and emails the invitee a link instead of a working login. */
export function inviteAgent(name: string, email: string, organization?: string): Promise<AgentInviteCreated> {
  return apiPost<AgentInviteCreated>("/api/agent-invites", { name, email, organization });
}

/** Public — the accept-invite page uses this to show who's being invited before asking for a
 * password. Throws (via apiClient's error handling) with a clear message if the token is
 * unknown/expired/already used. */
export function getAgentInvite(token: string): Promise<AgentInviteSummary> {
  return apiGet<AgentInviteSummary>(`/api/agent-invites/${token}`);
}

/** Public — sets the invitee's own password, creating their real Staff+User rows. Same response
 * shape as authClient.ts's login/register, for AuthContext to reuse directly. */
export function acceptAgentInvite(token: string, password: string): Promise<{ token: string; user: AuthUser }> {
  return apiPost<{ token: string; user: AuthUser }>(`/api/agent-invites/${token}/accept`, { password });
}
