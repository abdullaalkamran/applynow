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
    `You are the StudyOne AI assistant helping ${ctx.userName}, a student applying to study abroad. ` +
    `You can check and update their profile, explain the application and visa process, search for universities ` +
    `matching their requirements, view and create their applications, and send an update message to their ` +
    `counsellor or agent on their behalf. Actually use your tools to do things when asked, rather than only ` +
    `describing how. If asked what you can help with, summarize your available tools in plain language. ` +
    `Keep replies concise and friendly.`,
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
