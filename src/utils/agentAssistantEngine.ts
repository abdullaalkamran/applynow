import { AGENTS, CURRENT_AGENT_ID, UNIVERSITIES } from "../data/mockData";
import { getAllApplications } from "../data/applicationsStore";
import { loadAgentStudents } from "../data/agentStudentsStore";
import { VISA_STAGE_STATUSES } from "./agentPipeline";

export const AGENT_AI_SUGGESTIONS = [
  "Write a follow-up email to pending students",
  "Show students at risk of visa rejection",
  "Suggest universities for MSc Data Science",
];

function myStudents() {
  return loadAgentStudents();
}

function myApplications() {
  const students = myStudents();
  return getAllApplications().filter((a) => students.some((s) => s.id === a.studentId));
}

/** Builds a real answer from the agent's own actual caseload — real students, real application
 * statuses, real university data — never invented names or numbers. */
export function buildAgentAnswer(question: string): string {
  const q = question.toLowerCase();
  const students = myStudents();
  const apps = myApplications();
  const agent = AGENTS.find((a) => a.id === CURRENT_AGENT_ID);

  if (/follow.?up.*email|draft.*email|write.*email/.test(q)) {
    const pending = apps.filter((a) => a.waitingOn === "student");
    if (pending.length === 0) {
      return "None of your students currently have anything pending from their side — there's no one to chase right now.";
    }
    const lines = pending.slice(0, 6).map((a) => {
      const s = students.find((st) => st.id === a.studentId);
      return `- ${s?.name ?? "Student"} (${a.university}): ${a.nextAction}`;
    });
    return [
      "Subject: Action needed on your application",
      "",
      "Hi,",
      "",
      "Quick update on where things stand and what's needed from your side:",
      ...lines,
      "",
      "Please send these over as soon as you can so we can keep your application moving.",
      "",
      "Best,",
      agent?.name ?? "Your agent",
    ].join("\n");
  }

  if (/visa.*(risk|reject)|risk.*visa/.test(q)) {
    const visaApps = apps.filter((a) => VISA_STAGE_STATUSES.has(a.status));
    const atRisk = visaApps.filter((a) => {
      const s = students.find((st) => st.id === a.studentId);
      return s?.riskFlag && s.riskFlag !== "none";
    });
    if (visaApps.length === 0) return "No students are currently in the visa stage.";
    if (atRisk.length === 0) return `${visaApps.length} student${visaApps.length === 1 ? " is" : "s are"} in the visa stage right now, and none are flagged at risk.`;
    const names = atRisk.map((a) => students.find((s) => s.id === a.studentId)?.name).filter(Boolean);
    return `${atRisk.length} of ${visaApps.length} students in the visa stage ${atRisk.length === 1 ? "is" : "are"} flagged: ${names.join(", ")}. Worth a check-in before their visa submission.`;
  }

  const subjectMatch = q.match(/universit(?:y|ies)\s+for\s+(.+)/) ?? q.match(/suggest.*for\s+(.+)/);
  if (/suggest.*universit|universit.*suggest|recommend.*universit/.test(q) || subjectMatch) {
    const subjectQuery = subjectMatch?.[1]?.trim();
    const matches = subjectQuery
      ? UNIVERSITIES.filter((u) => u.subjects.some((s) => s.toLowerCase().includes(subjectQuery) || subjectQuery.includes(s.toLowerCase())))
      : [];
    const pool = matches.length > 0 ? matches : UNIVERSITIES;
    const top = [...pool]
      .sort((a, b) => (parseInt(a.worldRank.replace(/\D/g, ""), 10) || 999) - (parseInt(b.worldRank.replace(/\D/g, ""), 10) || 999))
      .slice(0, 3);
    const label = subjectQuery ? ` for ${subjectQuery}` : "";
    return `Top picks${label}: ${top.map((u) => `${u.name} (${u.worldRank})`).join(", ")}.`;
  }

  if (/how many|total|count/.test(q) && /student/.test(q)) {
    return `You currently have ${students.length} student${students.length === 1 ? "" : "s"} in your caseload and ${apps.length} active application${apps.length === 1 ? "" : "s"}.`;
  }

  return `I can help with that. Right now you have ${students.length} students and ${apps.length} active applications. Try asking me to draft a follow-up email, flag visa risk, or suggest universities for a subject.`;
}
