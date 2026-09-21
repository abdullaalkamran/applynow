import { useSearchParams } from "react-router-dom";
import { useAdminRange } from "../../context/AdminRangeContext";
import { ApplicationsTable } from "./ApplicationsTable";

/** Full-page version of the dashboard's applications table — same tabs and filters, defaulting
 * to "All Applications". Accepts ?q= (from the shell's global search) to pre-fill the search. */
export default function AdminApplications() {
  const { range } = useAdminRange();
  const [params] = useSearchParams();
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Applications</h1>
        <p className="mt-1 text-[12px] text-slate-500">Every application in the selected period, across all students, agents and counsellors.</p>
      </div>
      <ApplicationsTable range={range} initialTab="all" initialQuery={params.get("q") ?? ""} />
    </div>
  );
}
