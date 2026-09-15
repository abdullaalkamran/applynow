// The AI should speak first the moment the voice assistant is activated — a plain "Listening…"
// silence made it unclear the mic had actually turned on. One shared greeting builder so the
// browser-TTS, OpenAI-TTS, and Gemini Live voice engines all open the same way.
const GREETINGS = [
  "Hi {name}, how can I help you today?",
  "Hey {name}! What can I do for you?",
  "Hi {name}, I'm listening — what do you need?",
];

export function greetingFor(name: string): string {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const template = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  return template.replace("{name}", firstName);
}
