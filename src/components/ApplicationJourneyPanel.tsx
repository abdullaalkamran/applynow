import { useState } from "react";
import { Check, Circle, Lock, AlertTriangle, CalendarClock } from "lucide-react";
import { STAGE_ORDER, STAGE_LABEL, DEPOSIT_TYPES, type StageType, type ApplicationJourney } from "../types/journey";
import { FinancialReadinessHistory } from "./FinancialReadinessHistory";
import { daysHeldLabel } from "../utils/financialReadiness";
import { JourneyStageGrid } from "./JourneyStageGrid";
import { loadJourney, updateStage } from "../data/applicationJourneyStore";
import { computeCurrentStage, computeBlockers, computeNextAction } from "../utils/applicationJourneyEngine";
import { getApplicationTasks } from "../utils/taskBoard";
import { loadActivityDescending, recordActivity } from "../data/applicationActivityStore";
import { ADMISSION_OFFICERS, COUNSELLORS, AGENTS, STUDENTS } from "../data/mockData";
import { getAllApplications, assignCounsellor, assignAdmissionOfficer } from "../data/applicationsStore";
import { useRole } from "../context/RoleContext";
import type { Role } from "../types";

// The four stages that get full structured fields + editing this phase — everything else
// (Payment/Interview/Visa/E-Visa/Enrolment) gets a generic status+date editor for now. See the
// plan's Phase 1 scope confirmation.
const FULL_DEPTH_STAGES = new Set<StageType>(["application", "offer", "financial_readiness", "university_document"]);

// Short forms of STAGE_LABEL for the compact status strip — the full names (e.g. "University
// Immigration Document", "Financial Readiness") don't fit in a 9-across tile and were truncating
// mid-word ("UNIVERSITY IMMI...").
const STAGE_LABEL_SHORT: Record<StageType, string> = {
  application: "Application",
  offer: "Offer",
  financial_readiness: "Financial",
  payment: "Payment",
  interview: "Interview",
  university_document: "Immigration",
  visa: "Visa",
  evisa: "E-Visa",
  enrolment: "Enrolment",
};

interface Actor { id: string; role: Role; name: string }

interface Props {
  applicationId: string;
  mode: "staff" | "student";
  actor?: Actor; // required in staff mode to attribute edits; unused in student (read-only) mode
  token?: string; // lets a real status change fire the WhatsApp/email notification
}

/**
 * The combined single-column view — still used as-is for the student's simplified page
 * (ApplicationDetail.tsx). The counsellor's page instead composes the pieces below directly into
 * its own multi-column layout, since one long vertical stack stopped being readable once this
 * grew to cover all 9 stages plus tasks/activity/staff assignment.
 */
export function ApplicationJourneyPanel({ applicationId, mode, actor, token }: Props) {
  const [, forceTick] = useState(0);
  const journey = loadJourney(applicationId);
  const currentStage = computeCurrentStage(journey);
  const application = getAllApplications().find((a) => a.id === applicationId);
  const student = application ? STUDENTS.find((s) => s.id === application.studentId) : undefined;
  const agent = student?.agentId ? AGENTS.find((a) => a.id === student.agentId) : undefined;

  function patch(stageType: StageType, fieldPatch: Record<string, unknown>) {
    if (!actor) return;
    updateStage(applicationId, stageType, fieldPatch, actor, token);
    forceTick((t) => t + 1);
  }

  if (mode === "student") {
    // The student's view is the stage grid from the design plus a plain current-stage summary —
    // no "View Full Details" button (that's the counsellor card's way into its expanded editor).
    return (
      <div className="space-y-4">
        <JourneyStageGrid journey={journey} />
        <StudentSummary journey={journey} currentStage={currentStage} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <JourneyStepper journey={journey} />
      <div className="space-y-3">
        <JourneyStageEditor journey={journey} onPatch={patch} readOnly={!actor} />
        <ResponsibleStaffCard
          applicationId={applicationId}
          responsibleCounsellorId={application?.responsibleCounsellorId}
          responsibleAdmissionOfficerId={application?.responsibleAdmissionOfficerId}
          agentName={agent?.name}
          actor={actor}
          onChanged={() => forceTick((t) => t + 1)}
        />
        <ApplicationTasksCard applicationId={applicationId} />
        <ApplicationActivityCard applicationId={applicationId} />
      </div>
    </div>
  );
}

/** The multi-stage status grid + next-action/blockers banner — the "at a glance" summary of the
 * whole journey, independent of whether the caller also renders per-stage editing next to it. */
export function StageStatusStrip({ journey, dense = false }: { journey: ApplicationJourney; dense?: boolean }) {
  const currentStage = computeCurrentStage(journey);
  const visibleStages = STAGE_ORDER.filter((s) => journey.stages[s]?.applicable);

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleStages.map((stageType) => {
        const record = journey.stages[stageType]!;
        const done = !!record.completedAt;
        const active = stageType === currentStage;
        // Simple two-color read: green once a stage is actually done, red for everything still
        // outstanding (in progress, upcoming, or blocked) — the "at a glance" strip is meant to show
        // what still needs attention, not just what's next. The current stage keeps a ring so "you
        // are here" isn't lost inside the red.
        return (
          <div
            key={stageType}
            title={`${STAGE_LABEL[stageType]}: ${record.status}`}
            className={`min-w-[104px] flex-1 rounded-lg px-2 py-1.5 ${done ? "bg-emerald-50" : "bg-rose-50"} ${
              active ? "ring-2 ring-[var(--sd-ink)] ring-offset-1" : ""
            } ${dense ? "" : "sm:min-w-[140px]"}`}
          >
            <p className={`flex items-center gap-1 truncate text-[10px] font-medium uppercase tracking-wide ${done ? "text-emerald-600" : "text-rose-500"}`}>
              {done ? <Check size={10} /> : record.blocked ? <AlertTriangle size={10} /> : <Circle size={8} />}
              {STAGE_LABEL_SHORT[stageType]}
            </p>
            <p className={`line-clamp-2 text-[12px] font-medium leading-snug ${done ? "text-emerald-700" : "text-rose-700"}`}>
              {record.status}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** `showNextAction={false}` drops the "Next action" card — the student's page doesn't show it
 * (the student sees a plain stage/status summary instead; the next-action wording is written for
 * staff, e.g. "— Counsellor" / "— University" owners they can't act on). */
export function JourneyStepper({ journey, showStrip = true, showNextAction = true }: { journey: ApplicationJourney; showStrip?: boolean; showNextAction?: boolean }) {
  const blockers = computeBlockers(journey);
  const nextAction = showNextAction ? computeNextAction(journey) : null;

  return (
    <div className="space-y-3">
      {showStrip && <StageStatusStrip journey={journey} />}

      {nextAction && (
        <div className="rounded-xl border border-slate-100 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Next action</p>
          <p className="mt-0.5 text-[13px] text-slate-700">{nextAction.title} <span className="text-slate-400">— {nextAction.owner.role}</span></p>
        </div>
      )}
      {blockers.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-rose-100 bg-rose-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-500">Blockers</p>
          {blockers.map((b, i) => (
            <p key={i} className="text-[12.5px] text-rose-700">{b.description}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/** The per-stage editable cards — the "status" column's main content on the counsellor's page. */
export function JourneyStageEditor({ journey, onPatch, readOnly }: { journey: ApplicationJourney; onPatch: (stageType: StageType, patch: Record<string, unknown>) => void; readOnly: boolean }) {
  const visibleStages = STAGE_ORDER.filter((s) => journey.stages[s]?.applicable);
  return (
    <div className="space-y-2">
      {visibleStages.map((stageType) => (
        <StageCard key={stageType} stageType={stageType} journey={journey} onPatch={(p) => onPatch(stageType, p)} readOnly={readOnly} />
      ))}
    </div>
  );
}

/** Counsellor/admission assignment is a real field on the Application record itself
 * (`responsibleCounsellorId`/`responsibleAdmissionOfficerId`, set via assignCounsellor/
 * assignAdmissionOfficer in applicationsStore.ts) — pass those straight from the caller's own
 * Application object rather than from `journey`, which nothing ever writes them into (that used to
 * make this card always show "Unassigned" regardless of what was actually assigned). The agent
 * isn't reassignable per application — it's fixed on the student record — so it's shown here
 * read-only for context rather than as a third dropdown. */
export function ResponsibleStaffCard({
  applicationId, responsibleCounsellorId, responsibleAdmissionOfficerId, agentName, actor, onChanged,
}: {
  applicationId: string;
  responsibleCounsellorId?: string;
  responsibleAdmissionOfficerId?: string;
  agentName?: string;
  actor?: Actor;
  onChanged: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Responsible staff</p>
      <div className="grid grid-cols-2 gap-2">
        <SelectFieldInline
          label="Counsellor"
          value={responsibleCounsellorId ?? ""}
          options={["", ...COUNSELLORS.map((c) => c.id)]}
          optionLabels={{ "": "Unassigned", ...Object.fromEntries(COUNSELLORS.map((c) => [c.id, c.name])) }}
          onChange={(v) => {
            if (actor) assignCounsellor(applicationId, v, actor);
            onChanged();
          }}
          readOnly={!actor}
        />
        <SelectFieldInline
          label="Admission"
          value={responsibleAdmissionOfficerId ?? ""}
          options={["", ...ADMISSION_OFFICERS.map((o) => o.id)]}
          optionLabels={{ "": "Unassigned", ...Object.fromEntries(ADMISSION_OFFICERS.map((o) => [o.id, o.name])) }}
          onChange={(v) => {
            if (actor) assignAdmissionOfficer(applicationId, v, actor);
            onChanged();
          }}
          readOnly={!actor}
        />
      </div>
      <div className="mt-2 border-t border-slate-50 pt-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Agent</p>
        <p className="mt-0.5 text-[12.5px] text-slate-700">{agentName ?? "No agent (direct application)"}</p>
      </div>
    </div>
  );
}

/** Tasks scoped to exactly this application — selecting a different application shows that
 * application's own tasks, since getApplicationTasks filters by applicationId, not by assignee. */
export function ApplicationTasksCard({ applicationId }: { applicationId: string }) {
  const tasks = getApplicationTasks(applicationId);
  if (tasks.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center text-[12px] text-slate-400">No tasks on this application yet.</p>;
  }
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      {tasks.map((t) => (
        <label key={t.id} className="flex items-center gap-2 py-1 text-[12.5px] text-slate-700">
          <input type="checkbox" checked={t.done} onChange={t.onToggle} />
          <span className={t.done ? "text-slate-400 line-through" : ""}>{t.title}</span>
        </label>
      ))}
    </div>
  );
}

// Audit trail only — status changes, stage updates, assignments. Comments (action "comment_added")
// get their own dedicated thread, ApplicationCommentsCard below, rather than being mixed in here.
export function ApplicationActivityCard({ applicationId, limit = 8 }: { applicationId: string; limit?: number }) {
  const activity = loadActivityDescending(applicationId)
    .filter((e) => e.action !== "comment_added")
    .slice(0, limit);
  if (activity.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center text-[12px] text-slate-400">No activity recorded yet.</p>;
  }
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      {activity.map((e) => (
        <p key={e.id} className="py-0.5 text-[12px] text-slate-600">
          <span className="text-slate-400">{new Date(e.timestamp).toLocaleDateString()}</span>{" "}
          {e.action.replace(/_/g, " ")}{e.newValue ? `: ${e.newValue}` : ""}{" "}
          <span className="text-slate-400">— {e.performedBy.name}</span>
        </p>
      ))}
    </div>
  );
}

/** A shared comment thread on one application — every participant (student, responsible
 * counsellor/admission officer, agent) can post and read every comment, and posting one drops a
 * notification into every other participant's inbox (see server's POST /:id/activity). Works from
 * any role's page since it only needs useRole() for "who's posting this". */
export function ApplicationCommentsCard({ applicationId }: { applicationId: string }) {
  const { role, currentUser } = useRole();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const comments = loadActivityDescending(applicationId).filter((e) => e.action === "comment_added");

  function post() {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    recordActivity({
      applicationId,
      action: "comment_added",
      notes: text,
      performedBy: { id: currentUser.id, role, name: currentUser.name },
    });
    setDraft("");
    setPosting(false);
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment — visible to everyone on this application, and sent to their inbox."
          rows={2}
          className="flex-1 resize-none rounded-lg border border-slate-200 p-2 text-[12.5px] text-slate-700 outline-none focus:border-slate-300"
        />
        <button
          onClick={post}
          disabled={posting || !draft.trim()}
          className="shrink-0 rounded-lg bg-[image:var(--sd-gradient)] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
        >
          Post
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="mt-3 text-center text-[12px] text-slate-400">No comments yet.</p>
      ) : (
        // Bounded to its own scroll area — a long thread shouldn't keep expanding the page height.
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[12.5px] text-slate-700">{c.notes}</p>
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

function StudentSummary({ journey, currentStage }: { journey: ApplicationJourney; currentStage: StageType | null }) {
  // Per the workflow spec: students get a simplified view — status/next action/required docs only,
  // never the full editable staff picture.
  if (!currentStage) return <p className="text-[13px] text-slate-500">Every stage of your application is complete.</p>;
  const record = journey.stages[currentStage]!;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{STAGE_LABEL[currentStage]}</p>
      <p className="mt-0.5 text-[13px] text-slate-700">Status: {record.status}</p>
    </div>
  );
}

function StageCard({ stageType, journey, onPatch, readOnly }: { stageType: StageType; journey: ApplicationJourney; onPatch: (p: Record<string, unknown>) => void; readOnly: boolean }) {
  const record = journey.stages[stageType]!;
  const [open, setOpen] = useState(stageType === computeCurrentStage(journey));
  const data = record.data as Record<string, unknown>;
  // Financial Readiness is one shared record per student — its history is keyed by the student.
  const studentId = getAllApplications().find((a) => a.id === journey.applicationId)?.studentId;

  return (
    <div className="@container overflow-hidden rounded-xl border border-slate-100 bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="text-[13px] font-medium text-slate-800">{STAGE_LABEL[stageType]}</span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
          {readOnly && <Lock size={11} />}
          {record.status}
        </span>
      </button>
      {open && (
        // A container query, not a viewport one — this card renders both in a wide single-column
        // student page and squeezed into a narrow desktop column on the counsellor's page, and a
        // plain `sm:` breakpoint reacts to the whole viewport, not the actual space available here.
        // At counsellor-column widths that misfired into a 2-up split so tight (~83px/field) that
        // each field's fixed-width label alone exceeded it, collapsing the input to 0 width —
        // unclickable, looking like "the status form doesn't work".
        <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 p-3 @sm:grid-cols-2">
          {FULL_DEPTH_STAGES.has(stageType) ? (
            <FullDepthFields stageType={stageType} data={data} status={record.status} onPatch={onPatch} readOnly={readOnly} studentId={studentId} />
          ) : (
            <GenericFields stageType={stageType} data={data} status={record.status} onPatch={onPatch} readOnly={readOnly} />
          )}
        </div>
      )}
    </div>
  );
}

// Label sits inline, inside the same bordered row as the input, instead of on its own line above
// it — one row per field instead of two, which is most of what was reading as "too much text" next
// to how little space the actual field needs.
const fieldRowClass = "flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-[var(--sd-ink)]";
const fieldLabelClass = "w-[74px] shrink-0 truncate text-[10px] text-slate-400";
const fieldInputClass = "min-w-0 flex-1 bg-transparent text-[12.5px] text-slate-700 focus:outline-none disabled:text-slate-400";

function Field({ label, value, onChange, type = "text", readOnly }: { label: string; value: unknown; onChange: (v: string) => void; type?: string; readOnly: boolean }) {
  return (
    <label className={fieldRowClass}>
      <span className={fieldLabelClass}>{label}</span>
      <input type={type} className={fieldInputClass} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />
    </label>
  );
}

function SelectFieldInline({ label, value, options, optionLabels, onChange, readOnly }: { label: string; value: unknown; options: string[]; optionLabels?: Record<string, string>; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <label className={fieldRowClass}>
      <span className={fieldLabelClass}>{label}</span>
      <select className={fieldInputClass} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} disabled={readOnly}>
        {options.map((o) => <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>)}
      </select>
    </label>
  );
}

// Real status enums per generic stage — a plain text input let someone type a status the terminal-
// status check in applicationJourneyStore.ts could never recognize, so the stage could never
// auto-complete no matter what was typed. A dropdown of the actual valid values fixes both at once.
const GENERIC_STATUS_OPTIONS: Partial<Record<StageType, string[]>> = {
  payment: ["Preparing", "Not Yet Paid", "Waiting for Confirmation", "Paid", "Failed", "Refunded"],
  interview: ["Not Required", "Preparing", "Scheduled", "Completed", "Waiting for Result", "Passed", "Failed"],
  visa: ["Not Started", "Preparing", "Ready to Submit", "Submitted", "Application Running", "Additional Documents Required", "Interview Required", "Decision Pending", "Approved", "Rejected", "Withdrawn"],
  evisa: ["Not Required", "Pending", "Completed"],
  enrolment: ["Not Started", "Preparing", "Enrolled", "Not Enrolled", "Deferred", "Withdrawn"],
};

// A generic status + key-date editor for the five stages that don't get bespoke fields this phase
// (Payment/Interview/Visa/E-Visa/Enrolment) — one shared implementation rather than five.
function GenericFields({ stageType, data, status, onPatch, readOnly }: { stageType: StageType; data: Record<string, unknown>; status: string; onPatch: (p: Record<string, unknown>) => void; readOnly: boolean }) {
  const options = GENERIC_STATUS_OPTIONS[stageType] ?? [status];
  return (
    <>
      <SelectFieldInline label="Status" value={status} options={options} onChange={(v) => onPatch({ status: v })} readOnly={readOnly} />
      <Field label="Date" value={data.date ?? data.submissionDate ?? data.interviewDate} type="date" onChange={(v) => onPatch({ date: v })} readOnly={readOnly} />
      <Field label="Reference" value={data.reference ?? data.applicationNumber ?? data.paymentReference} onChange={(v) => onPatch({ reference: v })} readOnly={readOnly} />
      <Field label="Notes" value={data.notes} onChange={(v) => onPatch({ notes: v })} readOnly={readOnly} />
    </>
  );
}

function FullDepthFields({ stageType, data, status, onPatch, readOnly, studentId }: { stageType: StageType; data: Record<string, unknown>; status: string; onPatch: (p: Record<string, unknown>) => void; readOnly: boolean; studentId?: string }) {
  if (stageType === "application") {
    return (
      <>
        <SelectFieldInline
          label="Status"
          value={status}
          options={["Incomplete Profile", "Waiting for Documents", "Documents Ready", "Submitted to Portal", "Submitted to University", "Payment Required", "Interview Required", "On Hold", "Rejected"]}
          onChange={(v) => onPatch({ status: v })}
          readOnly={readOnly}
        />
        <SelectFieldInline label="Applied via" value={data.appliedVia} options={["Direct University Portal", "B2B Portal", "Agent Portal", "Partner Portal", "Email", "Other"]} onChange={(v) => onPatch({ appliedVia: v })} readOnly={readOnly} />
        <Field label="Portal" value={data.portalName} onChange={(v) => onPatch({ portalName: v })} readOnly={readOnly} />
        <Field label="App ref" value={data.applicationRef} onChange={(v) => onPatch({ applicationRef: v })} readOnly={readOnly} />
        <Field label="Uni student ID" value={data.universityStudentId} onChange={(v) => onPatch({ universityStudentId: v })} readOnly={readOnly} />
        <Field label="Portal date" value={data.portalSubmissionDate} type="date" onChange={(v) => onPatch({ portalSubmissionDate: v })} readOnly={readOnly} />
        <Field label="Uni sub. date" value={data.universitySubmissionDate} type="date" onChange={(v) => onPatch({ universitySubmissionDate: v })} readOnly={readOnly} />
      </>
    );
  }

  if (stageType === "offer") {
    return (
      <>
        <SelectFieldInline label="Status" value={status} options={["Waiting", "Conditional", "Unconditional", "Document Missing", "On Hold", "Rejected"]} onChange={(v) => onPatch({ status: v })} readOnly={readOnly} />
        <Field label="Cond. date" value={data.conditionalOfferDate} type="date" onChange={(v) => onPatch({ conditionalOfferDate: v })} readOnly={readOnly} />
        <Field label="Uncond. date" value={data.unconditionalOfferDate} type="date" onChange={(v) => onPatch({ unconditionalOfferDate: v })} readOnly={readOnly} />
        <Field label="Expiry" value={data.offerExpiryDate} type="date" onChange={(v) => onPatch({ offerExpiryDate: v })} readOnly={readOnly} />
        <Field label="Tuition" value={data.tuitionFee} type="number" onChange={(v) => onPatch({ tuitionFee: Number(v) })} readOnly={readOnly} />
        <Field label="Deposit" value={data.depositAmount} type="number" onChange={(v) => onPatch({ depositAmount: Number(v) })} readOnly={readOnly} />
        <Field label="Deposit due" value={data.depositDeadline} type="date" onChange={(v) => onPatch({ depositDeadline: v })} readOnly={readOnly} />
      </>
    );
  }

  if (stageType === "financial_readiness") {
    // Same field set, in the same order, as the student's own FinancialReadinessCard — both edit
    // the one shared record per student, so a counsellor sees exactly what the student entered
    // (and vice versa), with the same running days-held count under the cash-in date.
    const daysHeld = daysHeldLabel(data.openingDate as string | undefined);
    return (
      <>
        <SelectFieldInline label="Bank status" value={data.bankStatus} options={["Not Required", "Not Started", "Preparing", "Maintaining", "Matured", "Ready", "Expired"]} onChange={(v) => onPatch({ bankStatus: v, status: v })} readOnly={readOnly} />
        <Field label="Bank name" value={data.bankName} onChange={(v) => onPatch({ bankName: v })} readOnly={readOnly} />
        <SelectFieldInline label="Deposit" value={data.depositType} options={DEPOSIT_TYPES} onChange={(v) => onPatch({ depositType: v })} readOnly={readOnly} />
        <Field label="Cash-in" value={data.openingDate} type="date" onChange={(v) => onPatch({ openingDate: v })} readOnly={readOnly} />
        <Field label="Amt (BDT)" value={data.requiredAmount} type="number" onChange={(v) => onPatch({ requiredAmount: Number(v), currency: "BDT" })} readOnly={readOnly} />
        <SelectFieldInline label="Holder" value={data.accountHolder} options={["Student", "Mother", "Father", "Brother/Sister", "Other"]} onChange={(v) => onPatch({ accountHolder: v })} readOnly={readOnly} />
        <SelectFieldInline label="Acc. type" value={data.accountType} options={["Savings", "Current", "FDR", "Other"]} onChange={(v) => onPatch({ accountType: v })} readOnly={readOnly} />
        {daysHeld && (
          <p className="flex items-center gap-1 text-[11.5px] font-medium text-slate-600 @sm:col-span-2">
            <CalendarClock size={12} className="text-slate-400" /> {daysHeld}
          </p>
        )}
        {studentId && (
          <div className="@sm:col-span-2">
            <FinancialReadinessHistory studentId={studentId} />
          </div>
        )}
      </>
    );
  }

  // university_document
  return (
    <>
      <SelectFieldInline label="Doc type" value={data.docType} options={["CAS", "COE", "PAL", "I-20", "Other"]} onChange={(v) => onPatch({ docType: v })} readOnly={readOnly} />
      <SelectFieldInline
        label="Status"
        value={status}
        options={["Waiting for Documents", "Documents Received", "Waiting for Payment", "Waiting for Interview", "Form Filling", "Processing", "Received", "Rejected"]}
        onChange={(v) => onPatch({ status: v })}
        readOnly={readOnly}
      />
      <Field label="Requested" value={data.requestDate} type="date" onChange={(v) => onPatch({ requestDate: v })} readOnly={readOnly} />
      <Field label="Received" value={data.receivedDate} type="date" onChange={(v) => onPatch({ receivedDate: v })} readOnly={readOnly} />
      <Field label="Doc no." value={data.documentNumber} onChange={(v) => onPatch({ documentNumber: v })} readOnly={readOnly} />
      <SelectFieldInline
        label="Medical/TB"
        value={(data.medical as Record<string, unknown> | undefined)?.status ?? "Not Required"}
        options={["Not Required", "Not Started", "Appointment Booked", "Completed", "Uploaded", "Verified", "Expired"]}
        onChange={(v) => onPatch({ medical: { ...(data.medical as object), status: v } })}
        readOnly={readOnly}
      />
    </>
  );
}
