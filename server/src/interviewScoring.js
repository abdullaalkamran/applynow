// AI marking for one credibility-interview answer, per the rubric: relevance & directness (30%),
// consistency with prior answers in the session (30%), specificity/detail (20%), genuineness
// signals (20%). Reuses this app's existing provider abstraction (server/src/providers) rather
// than calling any LLM API directly — whichever provider is active in config (see config.js/
// settingsStore.js) is what actually scores the answer, same as the assistant chat route.
const { getConfig } = require("./config");
const { getProvider } = require("./providers");
const { extractJson } = require("./llmJson");

const RUBRIC_SYSTEM_PROMPT = `You are an expert study-visa credibility interview coach, marking one candidate's answer to one interview question.

Score strictly against this rubric, each on a 0-100 scale:
- relevance (30% weight): does the answer directly and specifically address the question asked, without dodging or wandering off-topic.
- consistency (30% weight): does the answer avoid contradicting anything the candidate said earlier in this same session (facts, plans, figures, names). If there are no prior answers, score consistency on internal coherence alone.
- specificity (20% weight): concrete, checkable detail — real numbers, names, dates, institutions — versus vague, generic phrasing.
- genuineness (20% weight): personalized reasoning that sounds like the candidate's own considered thinking, versus generic, rehearsed-sounding, or copy-pasted-sounding language.

Respond with ONLY a single JSON object, no markdown fences, no commentary before or after it, in exactly this shape:
{"scores": {"relevance": 0, "consistency": 0, "specificity": 0, "genuineness": 0}, "overall": 0, "feedback": ["...", "..."], "flags": ["..."]}

"feedback" is 2-4 short, specific, actionable bullet points (each under 25 words) the candidate can act on before their real interview.
"flags" lists short labels for anything genuinely concerning (e.g. "contradicts_prior_answer", "vague_funding_source", "sounds_rehearsed") — an empty array if none apply.
Every score must be an integer 0-100. "overall" should reflect the weighted rubric above.`;

function buildUserPrompt(question, answerText, priorAnswers) {
  const history = (priorAnswers || [])
    .map((a, i) => `Q${i + 1} (${a.category}): ${a.prompt}\nA${i + 1}: ${a.answerText}`)
    .join("\n\n");

  return [
    history ? `Prior answers in this session, earliest first:\n${history}\n` : "This is the first question in the session — no prior answers to check consistency against.",
    `Current question (category: ${question.category}): ${question.prompt}`,
    `Candidate's answer: ${answerText}`,
  ].join("\n\n");
}

function clampScore(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) throw new Error("Non-numeric score in scoring response.");
  return Math.max(0, Math.min(100, n));
}

function validate(parsed) {
  const scores = parsed?.scores;
  if (!scores || typeof scores !== "object") throw new Error("Missing scores object.");
  const relevance = clampScore(scores.relevance);
  const consistency = clampScore(scores.consistency);
  const specificity = clampScore(scores.specificity);
  const genuineness = clampScore(scores.genuineness);
  if (!Array.isArray(parsed.feedback) || parsed.feedback.length === 0) throw new Error("Missing feedback array.");

  // Recomputed from the rubric weights rather than trusting the model's own arithmetic — the
  // model's job is to judge each criterion, not to do the weighted average correctly.
  const overall = Math.round(relevance * 0.3 + consistency * 0.3 + specificity * 0.2 + genuineness * 0.2);

  return {
    scores: { relevance, consistency, specificity, genuineness },
    overall,
    feedback: parsed.feedback.map(String).slice(0, 6),
    flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : [],
  };
}

async function callOnce(userPrompt) {
  const provider = getProvider(getConfig().provider);
  const reply = await provider.send({ systemPrompt: RUBRIC_SYSTEM_PROMPT, messages: [{ role: "user", text: userPrompt }], tools: [] });
  if (reply.kind !== "text" || !reply.text) throw new Error("Scoring provider returned no text response.");
  return validate(JSON.parse(extractJson(reply.text)));
}

/** Scores one interview answer against the rubric above. Retries once on a parse/validation
 * failure (a model occasionally wraps JSON in prose despite instructions); on a second failure,
 * throws rather than fabricating a score — the route surfaces this as a clear error to the caller. */
async function scoreInterviewAnswer(question, answerText, priorAnswers) {
  try {
    return await callOnce(buildUserPrompt(question, answerText, priorAnswers));
  } catch {
    try {
      return await callOnce(buildUserPrompt(question, answerText, priorAnswers));
    } catch (secondErr) {
      throw Object.assign(
        new Error("Could not score this answer right now — the AI response wasn't valid. Please try submitting again."),
        { status: 502, cause: secondErr }
      );
    }
  }
}

module.exports = { scoreInterviewAnswer };
