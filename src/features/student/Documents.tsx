import { useState } from "react";
import { FileText, CheckCircle2 } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";

type DocStatus = "uploaded" | "pending" | "optional";
interface DocRow { name: string; required: boolean; status: DocStatus; tone: "rose" | "blue" }

const DOCS: DocRow[] = [
  { name: "Passport", required: true, status: "uploaded", tone: "rose" },
  { name: "Academic Transcript", required: true, status: "pending", tone: "rose" },
  { name: "English Proficiency", required: true, status: "pending", tone: "rose" },
  { name: "Statement of Purpose", required: true, status: "pending", tone: "blue" },
  { name: "CV / Resume", required: true, status: "uploaded", tone: "blue" },
  { name: "Financial Statement", required: true, status: "pending", tone: "rose" },
  { name: "Reference Letter", required: false, status: "optional", tone: "rose" },
  { name: "Portfolio", required: false, status: "optional", tone: "rose" },
];

const TABS = ["All", "Required", "Uploaded"] as const;

export default function Documents() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Required");

  const docs = DOCS.filter((d) => {
    if (tab === "Required") return d.required;
    if (tab === "Uploaded") return d.status === "uploaded";
    return true;
  });

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader title="My Documents" />

      <div className="px-5">
        <div className="flex items-center gap-2 rounded-xl bg-white p-1 shadow-sm shadow-black/[0.03]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition ${
                tab === t ? "bg-[var(--sd-ink)] text-white" : "text-slate-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2.5 pb-4">
          {docs.map((d) => (
            <div key={d.name} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm shadow-black/[0.03]">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${d.tone === "rose" ? "bg-[#FCEAE8] text-[#D8473C]" : "bg-[#E7EEFC] text-[#2955C4]"}`}>
                <FileText size={16} />
              </div>
              <p className="flex-1 text-[13px] font-medium text-slate-800">{d.name}</p>
              <StatusPill status={d.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto bg-[var(--sd-bg)] px-5 py-4">
        <button className="w-full rounded-xl bg-[var(--sd-ink)] py-3.5 text-[13px] font-semibold text-white">
          Upload Document
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: DocStatus }) {
  if (status === "uploaded") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-[var(--sd-teal)]">
        <CheckCircle2 size={13} /> Uploaded
      </span>
    );
  }
  if (status === "pending") {
    return <span className="rounded-full bg-[#FDF0DC] px-2.5 py-1 text-[11px] font-medium text-[#B8791C]">Pending</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-400">Optional</span>;
}
