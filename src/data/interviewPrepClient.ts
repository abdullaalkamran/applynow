// Thin client for /api/interview-prep (server/src/routes/interviewPrep.js). No caching layer like
// the rest of this app's stores — an interview session is a one-shot, per-visit flow (pick a set,
// answer questions, see a summary), not shared reference data other pages need to read
// synchronously, so plain async calls are simpler and correct here.
import { apiGet, apiPost } from "../utils/apiClient";

export interface InterviewQuestionSetSummary {
  id: string;
  name: string;
  institution_id?: string;
  question_count: number;
}

export interface InterviewQuestion {
  id: string;
  prompt: string;
  category: string;
}

export interface InterviewAnswerResult {
  scores: { relevance: number; consistency: number; specificity: number; genuineness: number };
  feedback: string[];
  flags: string[];
  overall: number;
  overall_so_far: number;
  next_question: InterviewQuestion | null;
}

export interface InterviewAnswerRecord {
  id: string;
  question: InterviewQuestion;
  answer_text: string;
  scores: InterviewAnswerResult["scores"];
  feedback: string[];
  flags: string[];
  overall: number;
  created_at: string;
}

export interface InterviewSessionDetail {
  session_id: string;
  status: "in_progress" | "completed";
  question_set: { id: string; name: string };
  overall_score?: number;
  answers: InterviewAnswerRecord[];
  created_at: string;
}

export function listInterviewQuestionSets(): Promise<InterviewQuestionSetSummary[]> {
  return apiGet<InterviewQuestionSetSummary[]>("/api/interview-prep/question-sets");
}

export function startInterviewSession(questionSetId: string): Promise<{ session_id: string; first_question: InterviewQuestion }> {
  return apiPost("/api/interview-prep/sessions", { question_set_id: questionSetId });
}

export function submitInterviewAnswer(sessionId: string, questionId: string, answerText: string): Promise<InterviewAnswerResult> {
  return apiPost(`/api/interview-prep/sessions/${sessionId}/answers`, { question_id: questionId, answer_text: answerText });
}

export function getInterviewSession(sessionId: string): Promise<InterviewSessionDetail> {
  return apiGet<InterviewSessionDetail>(`/api/interview-prep/sessions/${sessionId}`);
}
