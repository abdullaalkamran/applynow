// An agent turns their claimable (enrolled, not-yet-invoiced) commissions into an invoice here.
// Once an application is on an invoice it's "claimed" — it drops out of the claimable pool so the
// same enrolment can't be invoiced twice — and the invoice itself starts "Issued" until an admin
// marks it "Paid". Line amounts are snapshotted at creation time, so an invoice's total stays
// historically accurate even if an admin edits a university's commission rate afterwards.

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

const CLAIMED_PREFIX = "agent-claimed-applications:";
const INVOICES_PREFIX = "agent-invoices:";

function loadClaimedRaw(agentId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLAIMED_PREFIX + agentId);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveClaimedRaw(agentId: string, ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLAIMED_PREFIX + agentId, JSON.stringify(ids));
}

export function loadClaimedApplicationIds(agentId: string): Set<string> {
  return new Set(loadClaimedRaw(agentId));
}

export function loadInvoicesFor(agentId: string): AgentInvoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INVOICES_PREFIX + agentId);
    return raw ? (JSON.parse(raw) as AgentInvoice[]) : [];
  } catch {
    return [];
  }
}

function saveInvoices(agentId: string, invoices: AgentInvoice[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INVOICES_PREFIX + agentId, JSON.stringify(invoices));
}

export function createInvoice(agentId: string, lines: InvoiceLine[]): AgentInvoice {
  const existing = loadInvoicesFor(agentId);
  const invoice: AgentInvoice = {
    id: `INV-${new Date().getFullYear()}-${agentId.toUpperCase()}-${String(existing.length + 1).padStart(4, "0")}`,
    agentId,
    createdAt: new Date().toISOString().slice(0, 10),
    lines,
    totalAmount: lines.reduce((s, l) => s + l.amount, 0),
    status: "Issued",
  };
  saveInvoices(agentId, [...existing, invoice]);

  const claimed = loadClaimedRaw(agentId);
  saveClaimedRaw(agentId, [...new Set([...claimed, ...lines.map((l) => l.applicationId)])]);

  return invoice;
}

export function markInvoicePaid(agentId: string, invoiceId: string) {
  saveInvoices(agentId, loadInvoicesFor(agentId).map((inv) => (inv.id === invoiceId ? { ...inv, status: "Paid" as const } : inv)));
}

/** Cross-agent view for the admin finance page — every invoice raised by any of the given agents. */
export function loadAllInvoices(agentIds: string[]): AgentInvoice[] {
  return agentIds.flatMap((id) => loadInvoicesFor(id));
}
