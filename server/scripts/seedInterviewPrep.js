// One-off, idempotent seed for a default credibility-interview question set — this pass has no
// admin UI for authoring question sets yet, so without this there'd be nothing for a student to
// pick. Run with: node scripts/seedInterviewPrep.js
const prisma = require("../src/prismaClient");

const QUESTIONS = [
  { category: "Study Plan", prompt: "Why did you choose this specific course and university?" },
  { category: "Study Plan", prompt: "Why can't you study this same course in your home country?" },
  { category: "Financial", prompt: "How will you fund your tuition and living costs for the full duration of your studies?" },
  { category: "Financial", prompt: "Whose money is in your bank statement, and how did they earn it?" },
  { category: "Ties to Home", prompt: "What ties do you have to your home country that will bring you back after your studies?" },
  { category: "Ties to Home", prompt: "What does your family do, and how do they feel about you studying abroad?" },
  { category: "Post-Graduation", prompt: "What are your career plans immediately after you graduate?" },
  { category: "Post-Graduation", prompt: "How does this course connect to your previous education or work experience?" },
];

async function main() {
  const existing = await prisma.interviewQuestionSet.findFirst({ where: { name: "Study Visa Credibility Interview" } });
  if (existing) {
    console.log(`"${existing.name}" already exists (${existing.id}) — nothing to do.`);
    return;
  }

  const set = await prisma.interviewQuestionSet.create({
    data: {
      name: "Study Visa Credibility Interview",
      questions: {
        create: QUESTIONS.map((q, i) => ({ prompt: q.prompt, category: q.category, orderIndex: i })),
      },
    },
    include: { questions: true },
  });

  console.log(`Created "${set.name}" (${set.id}) with ${set.questions.length} questions.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
