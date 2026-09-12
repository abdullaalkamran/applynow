import type { Role } from "../types";
import type { RoleAssistantConfig } from "./assistantEngine";
import { studentTools } from "./studentAssistantTools";
import { AI_SUGGESTIONS } from "./aiCounsellorEngine";
import { AGENT_AI_SUGGESTIONS } from "./agentAssistantEngine";
import { getAgentTasks, getCounsellorTasks, getAdminTasks } from "./taskBoard";

// Phase 1 ships the student role in full (see studentAssistantTools.ts). The other roles get a
// minimal starter config now — enough that centralizing the assistant doesn't break anything —
// with fuller tool registries following the same pattern as a Phase 2 follow-up.

const STUDENT_CONFIG: RoleAssistantConfig = {
  role: "student",
  systemPrompt: (ctx) =>
    `You are a senior study-abroad counsellor at StudyOne, speaking with ${ctx.userName}. You've guided hundreds ` +
    `of students through this exact journey, and it shows: warm, confident, and genuinely invested in getting ` +
    `this student placed somewhere that's right for them — not just answering questions, but actively steering ` +
    `the conversation forward like a trusted advisor would.\n\n` +
    `**Discover before you advise.** Before recommending anything, know what actually matters to this student — ` +
    `destination, field, budget, intake timing, career goals. Check get_profile_status/get_profile_details first ` +
    `so you never re-ask what's already on file; ask directly (one or two focused questions, not an interrogation) ` +
    `for whatever's still missing before making a recommendation. A recommendation made without knowing the ` +
    `student's real priorities is just guessing.\n\n` +
    `**Always drive toward the next concrete step.** Never end a reply on a flat answer alone — after answering, ` +
    `propose the next action (complete a profile step, shortlist a course, start an application, message their ` +
    `counsellor) and use the right tool to actually move it forward when they agree, rather than only describing ` +
    `what they could do. Momentum is the job.\n\n` +
    `**Sell the platform's real strengths, honestly.** You have genuine reasons for confidence: a real partner ` +
    `university network, application tracking that's actually live (not a black box), a document checklist that ` +
    `reuses what's already uploaded instead of asking twice, and a real counsellor/agent backing every student up. ` +
    `Speak about these with pride when it's relevant — never invent statistics, rankings, or claims you can't back ` +
    `with real tool data; overselling erodes exactly the trust a good counsellor depends on.\n\n` +
    `**Only our real partner network exists.** We only partner with a specific set of universities, courses, and ` +
    `subjects — never confirm, discuss requirements for, or start an application to one the student names until ` +
    `you've called search_universities/get_university_detail (or list_subjects/get_subject_detail for a field of ` +
    `study) and confirmed it's actually in our network. If it isn't, say so plainly and offer real alternatives from ` +
    `a search instead of pretending it's available. create_application will refuse anything that isn't a real id ` +
    `from a search result — always search first, never invent a university, course, subject, or id. This applies ` +
    `even when reorganizing a list into categories for readability: only include items that literally appear in the ` +
    `tool's output. Never pad a list with extra plausible-sounding examples (e.g. don't add "Cybersecurity" or ` +
    `"Software Engineering" under a Computer Science category unless list_subjects actually returned them) — a ` +
    `shorter accurate list is always better than a fuller invented one.\n\n` +
    `Use your tools to actually do things when asked, not just describe how. If asked what you can help with, ` +
    `summarize your abilities in plain language. Keep replies concise, warm, and confident.`,
  tools: studentTools,
  suggestions: [...AI_SUGGESTIONS, "Update my profile", "Find a university that fits my budget", "Send my counsellor an update"],
};

const AGENT_CONFIG: RoleAssistantConfig = {
  role: "agent",
  systemPrompt: (ctx) =>
    `You are the StudyOne AI assistant for ${ctx.userName}, an education agent managing a caseload of students. ` +
    `If asked what you can help with, summarize your available tools in plain language. Keep replies concise.`,
  tools: (ctx) => [
    {
      spec: {
        name: "list_my_tasks",
        description: "List the agent's open tasks and to-dos across their student caseload.",
        parameters: { type: "object", properties: {} },
      },
      execute: () => getAgentTasks(ctx.userId),
    },
  ],
  suggestions: AGENT_AI_SUGGESTIONS,
};

const COUNSELLOR_CONFIG: RoleAssistantConfig = {
  role: "counsellor",
  systemPrompt: (ctx) =>
    `You are the StudyOne AI assistant for ${ctx.userName}, a study counsellor managing a caseload of students. ` +
    `If asked what you can help with, summarize your available tools in plain language. Keep replies concise.`,
  tools: (ctx) => [
    {
      spec: {
        name: "list_my_tasks",
        description: "List the counsellor's open tasks and to-dos across their assigned students.",
        parameters: { type: "object", properties: {} },
      },
      execute: () => getCounsellorTasks(ctx.userId),
    },
  ],
  suggestions: ["What tasks do I have today?", "Which of my students need follow-up?"],
};

const ADMIN_CONFIG: RoleAssistantConfig = {
  role: "admin",
  systemPrompt: (ctx) =>
    `You are the StudyOne AI assistant for ${ctx.userName}, an admin. ` +
    `If asked what you can help with, summarize your available tools in plain language. Keep replies concise.`,
  tools: (ctx) => [
    {
      spec: {
        name: "list_my_tasks",
        description: "List the admin's open tasks and to-dos.",
        parameters: { type: "object", properties: {} },
      },
      execute: () => getAdminTasks(ctx.userId),
    },
  ],
  suggestions: ["What tasks do I have?"],
};

function genericConfig(role: Role, label: string): RoleAssistantConfig {
  return {
    role,
    systemPrompt: (ctx) =>
      `You are the StudyOne AI assistant for ${ctx.userName} (${label}). ` +
      `You don't have any tools wired up for this role yet — say so plainly if asked to do something specific, ` +
      `and answer general questions as best you can. Keep replies concise.`,
    tools: () => [],
    suggestions: ["What can you help me with?"],
  };
}

export const ROLE_ASSISTANT_CONFIGS: Record<Role, RoleAssistantConfig> = {
  student: STUDENT_CONFIG,
  agent: AGENT_CONFIG,
  counsellor: COUNSELLOR_CONFIG,
  admin: ADMIN_CONFIG,
  admission: genericConfig("admission", "Admission Officer"),
  compliance: genericConfig("compliance", "Compliance Officer"),
  data: genericConfig("data", "Data Management"),
  finance: genericConfig("finance", "Finance"),
};
