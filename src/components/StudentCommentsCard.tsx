import { useState } from "react";
import { loadStudentComments, postStudentComment } from "../data/studentCommentsStore";
import { useRole } from "../context/RoleContext";

/** A shared comment thread on a student's overall case — every one of the student, their
 * counsellor and their agent can post and read every comment, and posting one drops a
 * notification into the others' inbox (see server's POST /api/students/:id/comments). Same shape
 * as ApplicationCommentsCard, just scoped to a student rather than one specific application. */
export function StudentCommentsCard({ studentId }: { studentId: string }) {
  const { role, currentUser } = useRole();
  const [draft, setDraft] = useState("");
  const comments = loadStudentComments(studentId);

  function post() {
    const text = draft.trim();
    if (!text) return;
    postStudentComment(studentId, text, { id: currentUser.id, role, name: currentUser.name });
    setDraft("");
  }

  return (
    <div>
      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment on this student's case — visible to their counsellor and agent, and sent to their inbox."
          rows={3}
          className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--sd-ink)] focus:outline-none"
        />
        <button
          onClick={post}
          disabled={!draft.trim()}
          className="shrink-0 self-end rounded-lg bg-[image:var(--sd-gradient)] px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          Post
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="mt-3 text-center text-[12.5px] text-slate-400">No comments yet.</p>
      ) : (
        // Bounded to its own scroll area — a growing case-long thread shouldn't keep expanding
        // the whole profile page's height along with it.
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[13px] text-slate-700">{c.notes}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {c.performedBy.name} ({c.performedBy.role}) — {new Date(c.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
