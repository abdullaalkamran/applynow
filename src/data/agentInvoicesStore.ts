// Postgres-backed via /api/agent-invoices (server/src/routes/agentInvoices.js) — same
// synchronous-cache pattern as staffStore.ts. Was localStorage-only until this migration: an agent
// turns their claimable (enrolled, not-yet-invoiced) commissions into an invoice here. Once an
// application is on an invoice it's "claimed" — it drops out of the claimable pool so the same
// enrolment can't be invoiced twice (enforced server-side by a unique constraint) — and the
// invoice itself starts "Issued" until an admin marks it "Paid". Line amounts are snapshotted at
// creation time, so an invoice's total stays historically accurate even if an admin edits a
// university's commission rate afterwards.
import { apiGet, apiPost, apiPatch } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

export interface InvoiceLine {
  applicationId: string;
  studentName: string;
  university: string;
  course: string;
  amount: number;
}

export interface AgentInvoice {
  id: string;
  agentId: string;
  createdAt: string;
  lines: InvoiceLine[];
  totalAmount: number;
  status: "Issued" | "Paid";
}

// An agent's fetch only ever returns their own invoices (server-scoped); an admin/internal
// caller's returns everyone's — see the route's own scoping. Either way this cache just holds
// whatever the server actually gave this session.
let cache: AgentInvoice[] = [];
let refreshSeq = 0;

export async function refreshAgentInvoices(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<AgentInvoice[]>("/api/agent-invoices");
  if (seq !== refreshSeq) return;
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function clearAgentInvoicesCache() {
  cache = [];
}

export function loadClaimedApplicationIds(agentId: string): Set<string> {
  return new Set(cache.filter((inv) => inv.agentId === agentId).flatMap((inv) => inv.lines.map((l) => l.applicationId)));
}

export function loadInvoicesFor(agentId: string): AgentInvoice[] {
  return cache.filter((inv) => inv.agentId === agentId);
}

/** Cross-agent view for the admin finance page — every invoice raised by any of the given agents. */
export function loadAllInvoices(agentIds: string[]): AgentInvoice[] {
  return cache.filter((inv) => agentIds.includes(inv.agentId));
}

/** Genuinely async (not optimistic) — the caller needs the real server-assigned invoice id before
 * it can render correctly, same trade-off as staffStore.ts's inviteStaff. `_agentId` is unused —
 * the server derives the real agent from the caller's own JWT — kept only so call sites (which
 * already have it on hand) don't need to change. */
export async function createInvoice(_agentId: string, lines: InvoiceLine[]): Promise<AgentInvoice> {
  const invoice = await apiPost<AgentInvoice>("/api/agent-invoices", { lines });
  cache = [invoice, ...cache];
  notifyCacheChange();
  return invoice;
}

export async function markInvoicePaid(_agentId: string, invoiceId: string): Promise<void> {
  const invoice = await apiPatch<AgentInvoice>(`/api/agent-invoices/${invoiceId}`, { status: "Paid" });
  cache = cache.map((inv) => (inv.id === invoiceId ? invoice : inv));
  notifyCacheChange();
}
