// Interview Prep — credibility-interview practice. See the build plan this implements; field
// names on the wire (question_set_id, answer_text, etc.) are snake_case per that plan's exact API
// contract, distinct from the rest of this app's camelCase convention elsewhere.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { scoreInterviewAnswer } = require("../interviewScoring");

const router = express.Router();

function serializeQuestion(q) {
  return { id: q.id, prompt: q.prompt, category: q.category };
}

function serializeAnswer(a) {
  return {
    id: a.id,
    question: serializeQuestion(a.question),
    answer_text: a.answerText,
    scores: a.scores,
    feedback: a.feedback.feedback,
    flags: a.feedback.flags,
    overall: a.overall,
    created_at: a.createdAt.toISOString(),
  };
}

router.get("/question-sets", requireAuth, async (req, res, next) => {
  try {
    const sets = await prisma.interviewQuestionSet.findMany({
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(sets.map((s) => ({ id: s.id, name: s.name, institution_id: s.institutionId || undefined, question_count: s._count.questions })));
  } catch (err) {
    next(err);
  }
});

router.post("/sessions", requireAuth, async (req, res, next) => {
  try {
    const { question_set_id: questionSetId } = req.body || {};
    if (!questionSetId) return res.status(400).json({ error: "question_set_id is required." });

    const firstQuestion = await prisma.interviewQuestion.findFirst({
      where: { questionSetId },
      orderBy: { orderIndex: "asc" },
    });
    if (!firstQuestion) return res.status(404).json({ error: "Question set not found or has no questions." });

    const session = await prisma.interviewSession.create({
      data: { userId: req.authUser.sub, questionSetId, status: "in_progress" },
    });

    res.status(201).json({ session_id: session.id, first_question: serializeQuestion(firstQuestion) });
  } catch (err) {
    next(err);
  }
});

router.post("/sessions/:id/answers", requireAuth, async (req, res, next) => {
  try {
    const { question_id: questionId, answer_text: answerText } = req.body || {};
    if (!questionId || typeof answerText !== "string" || !answerText.trim()) {
      return res.status(400).json({ error: "question_id and answer_text are required." });
    }

    const session = await prisma.interviewSession.findUnique({ where: { id: req.params.id } });
    if (!session || session.userId !== req.authUser.sub) return res.status(404).json({ error: "Session not found." });
    if (session.status === "completed") return res.status(409).json({ error: "This session is already complete." });

    const question = await prisma.interviewQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.questionSetId !== session.questionSetId) {
      return res.status(400).json({ error: "That question doesn't belong to this session's question set." });
    }
    const alreadyAnswered = await prisma.interviewAnswer.findUnique({ where: { sessionId_questionId: { sessionId: session.id, questionId } } });
    if (alreadyAnswered) return res.status(409).json({ error: "This question has already been answered in this session." });

    const priorRows = await prisma.interviewAnswer.findMany({
      where: { sessionId: session.id },
      include: { question: true },
      orderBy: { createdAt: "asc" },
    });
    const priorAnswers = priorRows.map((a) => ({ category: a.question.category, prompt: a.question.prompt, answerText: a.answerText }));

    const result = await scoreInterviewAnswer({ prompt: question.prompt, category: question.category }, answerText, priorAnswers);

    const answer = await prisma.interviewAnswer.create({
      data: {
        sessionId: session.id,
        questionId,
        answerText,
        scores: result.scores,
        feedback: { feedback: result.feedback, flags: result.flags },
        overall: result.overall,
      },
      include: { question: true },
    });

    const allAnswers = [...priorRows, answer];
    const overallSoFar = Math.round(allAnswers.reduce((sum, a) => sum + a.overall, 0) / allAnswers.length);

    // The lowest-orderIndex question this session hasn't answered yet — not just "the next one
    // after whichever was just submitted" — so a session only ever completes once every question
    // actually has an answer, regardless of what order they were answered in.
    const answeredIds = allAnswers.map((a) => a.questionId);
    const nextQuestion = await prisma.interviewQuestion.findFirst({
      where: { questionSetId: session.questionSetId, id: { notIn: answeredIds } },
      orderBy: { orderIndex: "asc" },
    });

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        overallScore: overallSoFar,
        status: nextQuestion ? "in_progress" : "completed",
      },
    });

    res.json({
      scores: result.scores,
      feedback: result.feedback,
      flags: result.flags,
      overall: result.overall,
      overall_so_far: overallSoFar,
      next_question: nextQuestion ? serializeQuestion(nextQuestion) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.interviewSession.findUnique({
      where: { id: req.params.id },
      include: {
        questionSet: true,
        answers: { include: { question: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!session || session.userId !== req.authUser.sub) return res.status(404).json({ error: "Session not found." });

    res.json({
      session_id: session.id,
      status: session.status,
      question_set: { id: session.questionSet.id, name: session.questionSet.name },
      overall_score: session.overallScore ?? undefined,
      answers: session.answers.map(serializeAnswer),
      created_at: session.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
