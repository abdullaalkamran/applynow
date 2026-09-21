import { DOCUMENTS, CURRENT_STUDENT_ID } from "../data/mockData";
import { getAllStudents } from "../data/allStudentsStore";
import { getAllUniversities } from "../data/universityCatalogStore";
import { getAllApplications } from "../data/applicationsStore";
import { loadUploadedDocs } from "../data/applicationDocsStore";
import { buildChecklist, buildCoreChecklist } from "./documentChecklist";
import { getProfileCompletion } from "../data/profileCompletion";

export interface ChatMessage { id: string; from: "ai" | "me"; text: string }

export const AI_SUGGESTIONS = [
  "What's my application status?",
  "Help me find a university",
  "How do I apply?",
  "Guide me through uploading documents",
  "Explain the visa process",
  "What scholarships can I get?",
];

// Minimal shape for the experimental Web Speech Recognition API — not yet in TypeScript's DOM lib.
// `resultIndex`/`isFinal` are only used by continuous-mode consumers (useSpeechToText.ts) — a
// single-shot caller (`continuous: false`) can safely ignore them.
export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Read fresh each call (not a module-level snapshot) so this reflects whoever's actually logged
 * in — see mockData.ts's CURRENT_STUDENT_ID doc comment. Falls back to a generic greeting for the
 * brief window right after login before allStudentsStore's cache resolves. */
export function currentAiStudentName(): string {
  return getAllStudents().find((s) => s.id === CURRENT_STUDENT_ID)?.name ?? "there";
}

function activeApplications() {
  return getAllApplications().filter(
    (a) => a.studentId === CURRENT_STUDENT_ID && !["Withdrawn", "Rejected", "Deferred"].includes(a.status)
  );
}

function missingDocSummary() {
  const missing: string[] = buildCoreChecklist(CURRENT_STUDENT_ID).filter((r) => !r.own).map((r) => r.type);
  const universities = getAllUniversities();
  activeApplications().forEach((app) => {
    const university = universities.find((u) => u.name === app.university);
    if (!university) return;
    const docs = [
      ...DOCUMENTS.filter((d) => d.studentId === CURRENT_STUDENT_ID && d.applicationId === app.id),
      ...loadUploadedDocs(app.id),
    ];
    buildChecklist(university, app.studentId, app.id, docs)
      .filter((r) => !r.own && !r.reused)
      .forEach((r) => missing.push(`${r.type} (${app.university})`));
  });
  return missing;
}

function bestUnappliedPick() {
  const applied = new Set(activeApplications().map((a) => a.university));
  return getAllUniversities()
    .filter((u) => !applied.has(u.name))
    .sort((a, b) => (parseInt(a.worldRank.replace(/\D/g, ""), 10) || 999) - (parseInt(b.worldRank.replace(/\D/g, ""), 10) || 999))[0];
}

/** Builds a real answer from the student's actual data — application status, outstanding
 * documents, profile completion, real scholarship-bearing universities — not a canned reply.
 * Ordered from most-specific ("how do I…" procedural guides) to most-general fallback, since a
 * broad keyword like "document" would otherwise swallow the more specific "how do I upload" ask. */
export function buildAnswer(question: string): string {
  const q = question.toLowerCase();
  const applications = activeApplications();
  const primary = [...applications].sort((a, b) => b.progress - a.progress)[0];
  const { percent, pendingSteps } = getProfileCompletion();

  if (/how.*(apply|application)|application process|steps to apply|apply to (a )?universit/.test(q)) {
    const already = primary ? ` You already have one in progress with ${primary.university} — "${primary.status}".` : "";
    return `Applying takes 4 steps: 1) Find a program on Explore — filter by destination, intake, fees, or scholarship. 2) Open the course and tap Apply Now, then choose your intake and campus. 3) Your application is created instantly and automatically pulls in any core documents you've already uploaded, so you're not starting from scratch. 4) Upload anything university-specific still needed and track real-time status from My Applications.${already}`;
  }

  if (/how.*(upload|submit).*doc|upload.*(process|procedure|work)|guide.*upload|walk.*through.*(upload|document)/.test(q)) {
    const missing = missingDocSummary();
    const status = missing.length === 0
      ? "You're fully caught up right now."
      : `You currently have ${missing.length} outstanding: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ", and more" : ""}.`;
    return `Document upload works in two layers. First, Core Documents — Passport, CV, English test, and your academic transcripts/certificates — upload each once in My Documents → Core Documents and it's automatically reused across every application, so you never re-upload the same file twice. Second, university-specific documents — open an application's Documents tab and it lists exactly what's still needed for that university, labeled with the stage it's needed for (Counsellor, Admission Officer, Agent, or Compliance review). Tap any checklist item to pick a file and it uploads immediately. ${status}`;
  }

  if (/find.*universit|search.*universit|looking for.*universit|help.*find|suggest|recommend|which universit|best universit/.test(q)) {
    const pick = bestUnappliedPick();
    if (!pick) return "You've already got applications in across our top picks — great work! Head to Explore if you'd like to widen your search.";
    const scholarshipNote = pick.scholarshipsAvailable ? " and scholarships available" : "";
    return `I'd start with Explore — filter by destination, intake, budget, or scholarship, and I'll narrow it down as you go. Right now, based on rankings, ${pick.name} (${pick.worldRank} globally, ${pick.employability} graduate employability${scholarshipNote}) looks like a strong fit for you. Want me to open it?`;
  }

  if (/document|missing|checklist|upload/.test(q)) {
    const missing = missingDocSummary();
    if (missing.length === 0) return "You're all caught up — every document on your checklist has been provided. 🎉";
    return `You still need ${missing.length} document${missing.length > 1 ? "s" : ""}: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? `, and ${missing.length - 4} more` : ""}. Open My Documents to upload them.`;
  }

  if (/status|progress|where.*application|application.*status/.test(q)) {
    if (!primary) return "You haven't started an application yet — head to Explore to find your first program!";
    return `Your application to ${primary.university} (${primary.course}) is "${primary.status}" and ${primary.progress}% complete. Next up: ${primary.nextAction}.`;
  }

  if (/scholarship/.test(q)) {
    const options = getAllUniversities().filter((u) => u.scholarshipsAvailable).slice(0, 3).map((u) => u.name);
    return `${options.length} universities in our catalogue currently offer scholarships, including ${options.join(", ")}. Filter by "Scholarship" on Explore to see them all.`;
  }

  if (/sop|statement of purpose/.test(q)) {
    return "For a strong Statement of Purpose: open with a specific moment that sparked your interest, connect it to concrete coursework or projects, explain why this exact program fits your goals, and close with where you see yourself after graduating. Keep it under 800 words.";
  }

  if (/visa/.test(q)) {
    const missing = missingDocSummary().filter((m) => /passport|financial statement|bank statement/i.test(m));
    const docNote = missing.length > 0 ? ` You're still missing visa-relevant paperwork: ${missing.join(", ")} — upload it from My Documents so it's ready when you need it.` : "";
    return `Visa steps generally follow: 1) accept your offer and pay any deposit, 2) receive your CAS/COE from the university, 3) submit your visa application with financial proof and passport, 4) attend a biometrics/interview appointment if required. Your Applications timeline shows exactly where you are in this process.${docNote}`;
  }

  if (/profile|complete my profile/.test(q)) {
    return pendingSteps.length === 0
      ? "Your profile is 100% complete — nice work!"
      : `Your profile is ${percent}% complete. Still to do: ${pendingSteps.map((s) => s.label).join(", ")}.`;
  }

  if (/hello|hi\b|hey/.test(q)) {
    return `Hi ${currentAiStudentName().split(" ")[0]}! Ask me about finding a university, applying, uploading documents, visas, or your application status.`;
  }

  return `I can help with that. Right now you have ${applications.length} active application${applications.length === 1 ? "" : "s"} and your profile is ${percent}% complete. Try asking me to find a university, walk you through applying or uploading documents, or check your application status.`;
}

/**
 * Async seam for the assistant's reply. Right now this just wraps the local rule-based
 * `buildAnswer` engine, but the signature is deliberately async so it's a drop-in swap for a real
 * model later — e.g. call the OpenAI Realtime API or Gemini Live API here with `question` (and
 * recent chat history for context) and return its text. Nothing else in the UI needs to change.
 */
export async function getAssistantReply(question: string): Promise<string> {
  return buildAnswer(question);
}
