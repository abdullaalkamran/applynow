import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, RotateCcw, Mic, Square } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";
import { Button, ProgressBar } from "../../components/ui";
import { useSpeechToText } from "../../utils/useSpeechToText";
import {
  listInterviewQuestionSets, startInterviewSession, submitInterviewAnswer, getInterviewSession,
  type InterviewQuestionSetSummary, type InterviewQuestion, type InterviewAnswerResult, type InterviewSessionDetail,
} from "../../data/interviewPrepClient";

const RECORDING_LIMIT_SECONDS = 60;

const CRITERIA: { key: keyof InterviewAnswerResult["scores"]; label: string }[] = [
  { key: "relevance", label: "Relevance & Directness" },
  { key: "consistency", label: "Consistency" },
  { key: "specificity", label: "Specificity & Detail" },
  { key: "genuineness", label: "Genuineness" },
];

type Stage =
  | { name: "pick" }
  | { name: "answering"; sessionId: string; question: InterviewQuestion; questionIndex: number; totalQuestions: number }
  | { name: "result"; sessionId: string; result: InterviewAnswerResult; answeredText: string; question: InterviewQuestion; questionIndex: number; totalQuestions: number }
  | { name: "summary"; sessionId: string };

export default function InterviewPrep() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const [sets, setSets] = useState<InterviewQuestionSetSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InterviewSessionDetail | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RECORDING_LIMIT_SECONDS);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const { isRecording, supported: micSupported, error: micError, start: startRecording, stop: stopRecording } = useSpeechToText(
    (chunk) => setDraft((prev) => (prev ? `${prev} ${chunk}` : chunk))
  );

  // A fresh question always starts with recording off and the full minute available, even if the
  // previous question's recording somehow didn't get stopped (e.g. the "Next Question" click).
  useEffect(() => {
    if (stage.name !== "answering") return;
    stopRecording();
    setSecondsLeft(RECORDING_LIMIT_SECONDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.name === "answering" ? stage.question.id : null]);

  // Counts down while recording; hitting zero stops the mic and auto-submits whatever's been
  // transcribed so far, moving the student on rather than leaving them stuck mid-recording.
  useEffect(() => {
    if (!isRecording) return;
    if (secondsLeft <= 0) {
      stopRecording();
      submit(draftRef.current);
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, secondsLeft]);

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      setSecondsLeft(RECORDING_LIMIT_SECONDS);
      startRecording();
    }
  }

  useEffect(() => {
    if (stage.name !== "pick" || sets !== null) return;
    listInterviewQuestionSets()
      .then(setSets)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load question sets."));
  }, [stage.name, sets]);

  useEffect(() => {
    if (stage.name !== "summary") return;
    getInterviewSession(stage.sessionId)
      .then(setSummary)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load session summary."));
  }, [stage]);

  async function pickSet(set: InterviewQuestionSetSummary) {
    setStarting(true);
    setLoadError(null);
    try {
      const { session_id, first_question } = await startInterviewSession(set.id);
      setStage({ name: "answering", sessionId: session_id, question: first_question, questionIndex: 1, totalQuestions: set.question_count });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to start a session.");
    } finally {
      setStarting(false);
    }
  }

  async function submit(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (stage.name !== "answering" || !text) return;
    stopRecording();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitInterviewAnswer(stage.sessionId, stage.question.id, text);
      setStage({
        name: "result", sessionId: stage.sessionId, result, answeredText: text,
        question: stage.question, questionIndex: stage.questionIndex, totalQuestions: stage.totalQuestions,
      });
      setDraft("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to score this answer — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    if (stage.name !== "result") return;
    if (stage.result.next_question) {
      setStage({
        name: "answering", sessionId: stage.sessionId, question: stage.result.next_question,
        questionIndex: stage.questionIndex + 1, totalQuestions: stage.totalQuestions,
      });
    } else {
      setSummary(null);
      setStage({ name: "summary", sessionId: stage.sessionId });
    }
  }

  function practiceAgain() {
    setSets(null);
    setSummary(null);
    setLoadError(null);
    setStage({ name: "pick" });
  }

  return (
    <div className="min-h-full pb-8">
      <div className="lg:mx-auto lg:w-full lg:max-w-2xl">
        <MobileHeader title="Interview Prep" onBack={() => navigate("/student")} />
      </div>

      <div className="px-5 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10">
        {stage.name === "pick" && (
          <div className="mt-3">
            <p className="text-[13px] text-slate-500">
              Practice credibility-interview questions and get instant AI feedback on each answer before your real interview.
            </p>
            {loadError && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-[12.5px] text-rose-600">{loadError}</p>}
            {sets === null && !loadError && <p className="mt-6 text-center text-[13px] text-slate-400">Loading question sets…</p>}
            {sets?.length === 0 && <p className="mt-6 text-center text-[13px] text-slate-400">No question sets available yet.</p>}
            <div className="mt-4 space-y-2.5">
              {sets?.map((set) => (
                <button
                  key={set.id}
                  onClick={() => pickSet(set)}
                  disabled={starting}
                  className="flex w-full items-center justify-between rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)] disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-slate-900">{set.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{set.question_count} question{set.question_count === 1 ? "" : "s"}</p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {stage.name === "answering" && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11.5px] text-slate-400">
              <span>Question {stage.questionIndex} of {stage.totalQuestions}</span>
              <span className="uppercase tracking-wide">{stage.question.category}</span>
            </div>
            <ProgressBar value={((stage.questionIndex - 1) / stage.totalQuestions) * 100} size="sm" />
            <p className="mt-4 text-[16px] font-semibold leading-snug text-slate-900">{stage.question.prompt}</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your answer, or tap the mic to speak it…"
              rows={7}
              disabled={submitting}
              className="mt-4 w-full resize-none rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 text-[13.5px] text-slate-700 shadow-[0_0_10px_rgba(0,0,0,0.06)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--sd-ink)]/10 disabled:opacity-60"
            />

            {micSupported && (
              <div className="mt-2 flex items-center gap-2.5">
                <button
                  onClick={toggleRecording}
                  disabled={submitting}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
                    isRecording ? "bg-rose-500 text-white" : "bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
                  }`}
                  aria-label={isRecording ? "Stop recording" : "Record your answer"}
                >
                  {isRecording ? <Square size={14} fill="currentColor" /> : <Mic size={16} />}
                </button>
                {isRecording ? (
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-rose-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                    Recording — auto-submits in {secondsLeft}s
                  </p>
                ) : (
                  <p className="text-[12px] text-slate-400">Tap to record your answer (up to 1 minute)</p>
                )}
              </div>
            )}
            {micError && <p className="mt-2 text-[12.5px] text-rose-600">{micError}</p>}
            {submitError && <p className="mt-2 text-[12.5px] text-rose-600">{submitError}</p>}
            <Button onClick={submit} disabled={!draft.trim() || submitting} className="mt-4 w-full justify-center">
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  Scoring your answer
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white" />
                  </span>
                </span>
              ) : (
                "Submit Answer"
              )}
            </Button>
          </div>
        )}

        {stage.name === "result" && (
          <div className="mt-3">
            <p className="text-[11.5px] uppercase tracking-wide text-slate-400">{stage.question.category}</p>
            <p className="mt-1 text-[14px] font-semibold text-slate-900">{stage.question.prompt}</p>

            <div className="mt-4 rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-800">Overall</p>
                <p className="text-[18px] font-bold text-slate-900">{stage.result.overall}<span className="text-[12px] font-medium text-slate-400">/100</span></p>
              </div>
              <div className="mt-3 space-y-3">
                {CRITERIA.map((c) => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between text-[12px] text-slate-600">
                      <span>{c.label}</span>
                      <span className="font-medium text-slate-800">{stage.result.scores[c.key]}</span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar value={stage.result.scores[c.key]} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              <p className="text-[13px] font-semibold text-slate-800">Feedback</p>
              <ul className="mt-2 space-y-1.5">
                {stage.result.feedback.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-600">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                    {f}
                  </li>
                ))}
              </ul>
              {stage.result.flags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {stage.result.flags.map((flag) => (
                    <span key={flag} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-700">
                      {flag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={nextQuestion} className="mt-4 w-full justify-center">
              {stage.result.next_question ? "Next Question" : "See Summary"} <ArrowRight size={15} />
            </Button>
          </div>
        )}

        {stage.name === "summary" && (
          <div className="mt-3">
            {!summary && !loadError && <p className="mt-6 text-center text-[13px] text-slate-400">Loading summary…</p>}
            {loadError && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-[12.5px] text-rose-600">{loadError}</p>}
            {summary && (
              <>
                <div className="flex flex-col items-center rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                  <p className="mt-2 text-[13px] font-medium text-slate-500">{summary.question_set.name}</p>
                  <p className="mt-1 text-[34px] font-bold text-slate-900">{summary.overall_score ?? "—"}<span className="text-[16px] font-medium text-slate-400">/100</span></p>
                  <p className="text-[12.5px] text-slate-400">Readiness score across {summary.answers.length} question{summary.answers.length === 1 ? "" : "s"}</p>
                </div>

                <p className="mt-5 text-[13px] font-semibold text-slate-800">Per-question breakdown</p>
                <div className="mt-2 space-y-2">
                  {summary.answers.map((a, i) => (
                    <div key={a.id} className="rounded-xl bg-[var(--sd-card)] p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-[12.5px] font-medium text-slate-800">Q{i + 1}. {a.question.prompt}</p>
                        <span className="shrink-0 text-[13px] font-bold text-slate-900">{a.overall}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11.5px] text-slate-500">{a.answer_text}</p>
                    </div>
                  ))}
                </div>

                <Button onClick={practiceAgain} className="mt-5 w-full justify-center">
                  <RotateCcw size={15} /> Practice Again
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
