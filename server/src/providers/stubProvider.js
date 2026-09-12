// No API key, no network call — for exercising the full tool-execution round trip locally
// (frontend tool wiring, localStorage mutation, history threading, voice loop) before any real
// provider key exists. Picks a tool by simple keyword overlap against the last user message, then
// on the next turn (once it sees the tool's result in history) just summarizes that result.

// Naive stemmer so "universities" matches a tool description written as "university" — good
// enough for picking a plausible tool locally; a real provider does proper language understanding.
function stem(word) {
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}

function pickTool(userText, tools) {
  const userTokens = new Set(tokenize(userText));
  let best = null;
  let bestScore = 0;

  for (const tool of tools || []) {
    const toolTokens = tokenize(`${tool.name} ${tool.description || ""}`);
    const score = toolTokens.filter((token) => userTokens.has(token)).length;
    if (score > bestScore) {
      bestScore = score;
      best = tool;
    }
  }

  return bestScore > 0 ? best : null;
}

async function send({ messages, tools }) {
  const lastMessage = messages[messages.length - 1];

  if (lastMessage?.role === "tool") {
    return {
      kind: "text",
      text: `Done. Here's what I got back: ${JSON.stringify(lastMessage.toolResult)}`,
    };
  }

  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const tool = pickTool(lastUserMessage?.text, tools);

  if (!tool) {
    return { kind: "text", text: "(stub provider) I couldn't match that to a tool — try rephrasing, or set AI_PROVIDER to a real provider." };
  }

  return {
    kind: "tool_call",
    toolCalls: [{ id: `${tool.name}_stub`, name: tool.name, arguments: {} }],
  };
}

module.exports = { send };
