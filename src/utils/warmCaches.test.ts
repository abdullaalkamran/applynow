import { describe, it, expect, vi, beforeEach } from "vitest";

// Every store module warmCaches talks to, replaced by stubs that record which refresh functions were called.
const calls = vi.hoisted(() => ({ names: [] as string[], role: "student" as string | undefined }));
// Every store module warmCaches talks to, with the names it imports — each becomes a stub that records the call.
const MODULES: Record<string, string[]> = {
  "../data/applicationsStore": ["clearApplicationsCache", "refreshApplications"],
  "../data/tasksStore": ["clearTasksCache", "refreshTasks"],
  "../data/staffStore": ["clearStaffCache", "refreshStaff"],
  "../data/agentStudentsStore": ["clearAgentStudentsCache", "refreshAgentStudents"],
  "../data/counsellorStudentsStore": ["clearCounsellorStudentsCache", "refreshAssignedStudents"],
  "../data/allStudentsStore": ["clearAllStudentsCache", "refreshAllStudents"],
  "../data/profileSync": ["clearProfileCache", "refreshProfileSections"],
  "../data/coreDocsStore": ["clearCoreDocsCache", "refreshCoreDocs"],
  "../data/applicationDocsStore": ["clearApplicationDocsCache", "refreshApplicationDocs"],
  "../data/applicationNextStepsStore": ["clearApplicationNextStepsCache", "refreshNextSteps"],
  "../data/documentDueDatesStore": ["clearDocumentDueDatesCache", "refreshDocDueDates"],
  "../data/studentFinancialReadinessStore": ["clearStudentFinancialReadinessCache", "refreshFinancialReadiness"],
  "../data/studentBankAccountsStore": ["clearBankAccountsCache", "refreshBankAccounts"],
  "../data/applicationJourneyStore": ["clearApplicationJourneyCache", "refreshCachedJourneys"],
  "../data/applicationActivityStore": ["clearApplicationActivityCache", "refreshCachedActivity"],
  "../data/inboxStore": ["clearInboxCache", "refreshInbox"],
  "../data/studentCommentsStore": ["clearStudentCommentsCache", "refreshCachedStudentComments"],
  "../data/messagesStore": ["clearMessagesCache", "refreshCachedMessageThreads", "refreshContacts", "refreshThreadsList"],
  "../data/subjectCatalogStore": ["clearSubjectCatalogCache", "refreshSubjectCatalog"],
  "../data/commissionRatesStore": ["clearCommissionRatesCache", "refreshCommissionRates"],
  "../data/agentInvoicesStore": ["clearAgentInvoicesCache", "refreshAgentInvoices"],
  "../data/universityCatalogStore": ["clearUniversityCatalogCache", "migrateLegacyLocalUniversities", "refreshUniversities"],
  "../data/countryRegistry": ["clearCountryRegistryCache", "migrateLegacyLocalCountries", "refreshCountries"],
};
for (const [path, names] of Object.entries(MODULES)) {
  vi.doMock(path, () => Object.fromEntries(names.map((n) => [n, () => { calls.names.push(n); return Promise.resolve(); }])));
}
vi.doMock("./syncCache", () => ({ notifyCacheChange: () => {} }));
vi.doMock("./authClient", () => ({ loadStoredAuth: () => (calls.role ? { token: "t", user: { role: calls.role } } : null) }));

async function warmAs(role: string | undefined) {
  vi.resetModules();
  calls.names = [];
  calls.role = role;
  const { warmCaches } = await import("./warmCaches");
  warmCaches(true);
  await new Promise((r) => setTimeout(r, 0)); // the reference-data refreshes run after their migration promises
  return new Set(calls.names);
}

beforeEach(() => { calls.names = []; });

describe("warmCaches loads only what each role uses", () => {
  it("a student never asks for staff, agent, counsellor or invoice data", async () => {
    const called = await warmAs("student");
    for (const n of ["refreshStaff", "refreshAgentStudents", "refreshAssignedStudents", "refreshAgentInvoices"]) expect(called.has(n), n).toBe(false);
    for (const n of ["refreshAllStudents", "refreshApplications", "refreshProfileSections", "refreshUniversities", "refreshInbox"]) expect(called.has(n), n).toBe(true);
  });

  it("an agent loads their own students and invoices, not staff or counsellor lists", async () => {
    const called = await warmAs("agent");
    expect(called.has("refreshAgentStudents")).toBe(true);
    expect(called.has("refreshAgentInvoices")).toBe(true);
    expect(called.has("refreshStaff")).toBe(false);
    expect(called.has("refreshAssignedStudents")).toBe(false);
  });

  it.each(["counsellor", "admission", "compliance", "data", "finance", "admin"])("%s (internal staff) loads the staff-side data", async (role) => {
    const called = await warmAs(role);
    for (const n of ["refreshStaff", "refreshAssignedStudents", "refreshAgentInvoices", "refreshAllStudents"]) expect(called.has(n), n).toBe(true);
    expect(called.has("refreshAgentStudents")).toBe(false);
  });
});
