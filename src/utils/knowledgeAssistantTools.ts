// Counsellor/agent training knowledge (British Council / ICEF course notes, playbooks, FAQs) that Data
// Management authors under /staff/data/knowledge, exposed to every staff-facing assistant as one search
// tool. Students' assistant deliberately doesn't get it — it's internal coaching material.
import { apiGet } from "./apiClient";
import type { ToolDefinition } from "./assistantEngine";

export const KNOWLEDGE_GUIDANCE =
  `**You have an internal training knowledge base** (counselling best practice, agent training notes, ` +
  `process guidance) behind search_knowledge. Call it before answering "how should I handle…", best-practice, ` +
  `ethics/compliance-of-advice, or counselling-technique questions, and say which document the guidance came ` +
  `from. If it returns nothing relevant, say the knowledge base doesn't cover it rather than inventing guidance — ` +
  `and never present it as an official immigration rule; visa/country requirements come from the country guide tools.`;

export function knowledgeTools(): ToolDefinition[] {
  return [
    {
      spec: {
        name: "search_knowledge",
        description: "Search the internal counsellor/agent training knowledge base (counselling technique, objection handling, ethics, process guidance, notes from professional training courses). Pass a few keywords describing the topic. Returns up to 5 passages with their document title and source.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
      execute: async (args) => {
        try {
          return await apiGet(`/api/knowledge/search?q=${encodeURIComponent(String(args.query ?? ""))}`);
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Knowledge search failed." };
        }
      },
    },
  ];
}
