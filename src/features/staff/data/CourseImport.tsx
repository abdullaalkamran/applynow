// Data Management → University → "Import from URLs": the course flavour of ImportQueue.tsx.
// Rows belong to one university; review happens in CourseForm (`?importId=`).
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getUniversityById } from "../../../data/universityCatalogStore";
import {
  createCourseImports, deleteCourseImport, discardCourseImport, listCourseImports, runCourseImport, type CourseImportItem,
} from "../../../data/courseImportsStore";
import { ImportQueue, type QueueAdapter } from "./ImportQueue";

export default function DataCourseImport() {
  const navigate = useNavigate();
  const { id } = useParams();
  const university = id ? getUniversityById(id) : undefined;

  if (!university) {
    return (
      <div>
        <button onClick={() => navigate("/staff/data")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
          <ArrowLeft size={14} /> Back to Countries
        </button>
        <p className="text-xs text-slate-400">University not found.</p>
      </div>
    );
  }

  const backTarget = `/staff/data/universities/${university.id}`;
  const adapter: QueueAdapter<CourseImportItem> = {
    title: "Import courses from URLs",
    subtitle: `${university.name} · Paste course page links, one per line. The AI drafts each course from its page; you review and approve every one before it's added — nothing goes live unreviewed.`,
    backLabel: `Back to ${university.name}`,
    backTo: { path: backTarget, state: { tab: "Courses" } },
    urlPlaceholder: "https://www.example.ac.uk/courses/msc-data-science\nhttps://www.example.ac.uk/courses/mba\n…one URL per line, up to 50 at a time",
    notice:
      (university.subjects ?? []).length === 0 ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {university.name} has no subjects selected yet, so every imported course will need its subject picked by hand.{" "}
            <button onClick={() => navigate(`${backTarget}/edit`)} className="font-semibold underline underline-offset-2">Add subjects on Edit Details</button> first for better matching.
          </span>
        </p>
      ) : undefined,
    emptyText: `No imports yet for ${university.name} — paste some course page links above to start.`,
    list: () => listCourseImports(university.id),
    create: (urls) => createCourseImports(university.id, urls),
    run: (row, opts) => runCourseImport(row.id, opts),
    discard: (row) => discardCourseImport(row.id),
    remove: (row) => deleteCourseImport(row.id),
    reviewPath: (row) => `${backTarget}/courses/new?importId=${row.id}`,
    approvedPath: (row) => (row.approvedCourseId ? `${backTarget}/courses/${row.approvedCourseId}` : undefined),
    summary: (row) => {
      const c = row.extracted?.course;
      if (!c?.name) return null;
      return {
        title: c.name,
        detail: (
          <>
            {c.subject || <span className="text-amber-700">subject not matched</span>} · {c.level} · {c.duration || "duration ?"}
            {c.feeUSD ? ` · ${c.currencySymbol ?? ""}${c.feeUSD.toLocaleString()}/yr` : " · fee ?"}
          </>
        ),
      };
    },
    reviewLabel: "Review & approve",
    openLabel: "Open course",
  };

  return <ImportQueue adapter={adapter} />;
}
