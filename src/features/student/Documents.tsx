import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { MobileHeader, LogoBadge, DocChecklistRow, type ScanStatus, type UploadedDoc } from "../../components/ui/mobile";
import { UNIVERSITIES, DOCUMENTS, CURRENT_STUDENT_ID } from "../../data/mockData";
import { getAllApplications } from "../../data/applicationsStore";
import { loadUploadedDocs, addUploadedDoc } from "../../data/applicationDocsStore";
import { addCoreDoc } from "../../data/coreDocsStore";
import { buildChecklist, buildCoreChecklist, coreDocTypes, docMatchesType } from "../../utils/documentChecklist";

const CORE_KEY = "core";

export default function Documents() {
  const navigate = useNavigate();
  const [uploadKey, setUploadKey] = useState<string | null>(null); // `${CORE_KEY | applicationId}::${type}`
  const [uploadingFile, setUploadingFile] = useState<UploadedDoc | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [expanded, setExpanded] = useState<Set<string>>(new Set([CORE_KEY]));
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const applications = getAllApplications().filter(
    (a) => a.studentId === CURRENT_STUDENT_ID && !["Withdrawn", "Rejected", "Deferred"].includes(a.status)
  );

  function startUpload(scope: string, type: string) {
    setUploadKey(`${scope}::${type}`);
    setUploadingFile(null);
    setScanStatus("idle");
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }

  function handleFile(file: File) {
    if (!uploadKey) return;
    const [scope, type] = uploadKey.split("::");
    const isImage = file.type.startsWith("image/");
    setUploadingFile({ name: file.name, previewUrl: isImage ? URL.createObjectURL(file) : undefined });
    setScanStatus("scanning");
    window.setTimeout(() => {
      setScanStatus("done");
      if (scope === CORE_KEY) addCoreDoc(type, isImage ? URL.createObjectURL(file) : undefined);
      else addUploadedDoc(scope, type, isImage ? URL.createObjectURL(file) : undefined);
      window.setTimeout(() => { setUploadKey(null); setUploadingFile(null); setScanStatus("idle"); }, 600);
    }, 1200);
  }

  const coreRows = buildCoreChecklist(CURRENT_STUDENT_ID);
  const coreMissing = coreRows.filter((r) => !r.own).length;
  const coreOpen = expanded.has(CORE_KEY);
  const coreTypes = coreDocTypes();

  return (
    <div className="flex min-h-full flex-col">
      <div className="lg:mx-auto lg:w-full lg:max-w-4xl">
        <MobileHeader title="My Documents" />
      </div>

      <div className="px-5 pb-6 lg:mx-auto lg:w-full lg:max-w-4xl lg:px-10">
        <p className="mb-3 text-[13px] text-slate-500">
          Upload your core documents once — every application reuses them automatically. Each application below then
          only asks for what's specific to that university.
        </p>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-[#B9D4FA] bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <button
              onClick={() => toggleExpanded(CORE_KEY)}
              className={`flex w-full items-center gap-3 p-4 text-left ${coreOpen ? "border-b border-slate-50" : ""}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E7EEFC] text-[#2955C4]">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-slate-900">Core Documents</p>
                <p className="truncate text-xs text-slate-400">Upload once, used for every application</p>
              </div>
              {coreMissing > 0 ? (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-[#FDF0DC] px-2.5 py-1 text-[11px] font-semibold text-[#B8791C]">
                  {coreMissing} {coreMissing === 1 ? "doc" : "docs"} needed
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[var(--sd-teal)]">
                  <CheckCircle2 size={13} /> All provided
                </span>
              )}
              <ChevronDown size={16} className={`shrink-0 text-slate-300 transition-transform ${coreOpen ? "rotate-180" : ""}`} />
            </button>

            {coreOpen && (
              <div className="space-y-2 p-3.5">
                {coreRows.map((row) => (
                  <DocChecklistRow
                    key={row.type}
                    type={row.type}
                    own={row.own}
                    isUploading={uploadKey === `${CORE_KEY}::${row.type}`}
                    uploadingFile={uploadingFile}
                    scanStatus={scanStatus}
                    onStartUpload={() => startUpload(CORE_KEY, row.type)}
                    onCancelUpload={() => { setUploadKey(null); setUploadingFile(null); setScanStatus("idle"); }}
                  />
                ))}
              </div>
            )}
          </div>

          {applications.map((app) => {
            const university = UNIVERSITIES.find((u) => u.name === app.university);
            if (!university) return null;

            const linkedDocs = DOCUMENTS.filter((d) => d.studentId === CURRENT_STUDENT_ID && d.applicationId === app.id);
            const uploaded = loadUploadedDocs(app.id);
            const docs = [...linkedDocs, ...uploaded];
            const rows = buildChecklist(university, app.studentId, app.id, docs);
            const doneCount = rows.filter((r) => r.own || r.reused).length;
            const missingCount = rows.length - doneCount;
            const extraDocs = docs.filter(
              (d) => !rows.some((r) => docMatchesType(d.name, r.type)) && !coreTypes.some((t) => docMatchesType(d.name, t))
            );
            const isOpen = expanded.has(app.id);

            return (
              <div key={app.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                <button
                  onClick={() => toggleExpanded(app.id)}
                  className={`flex w-full items-center gap-3 p-4 text-left ${isOpen ? "border-b border-slate-50" : ""}`}
                >
                  <LogoBadge name={app.university} tone={university.tone} logoUrl={university.logoUrl} className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{app.university}</p>
                    <p className="truncate text-xs text-slate-400">{app.course}</p>
                  </div>
                  {rows.length === 0 ? (
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">No extra docs needed</span>
                  ) : missingCount > 0 ? (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-[#FDF0DC] px-2.5 py-1 text-[11px] font-semibold text-[#B8791C]">
                      {missingCount} {missingCount === 1 ? "doc" : "docs"} needed
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[var(--sd-teal)]">
                      <CheckCircle2 size={13} /> All provided
                    </span>
                  )}
                  <ChevronDown size={16} className={`shrink-0 text-slate-300 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="space-y-2 p-3.5">
                    {rows.length === 0 && (
                      <p className="px-1 py-1 text-[12.5px] text-slate-400">
                        This university doesn't need anything beyond your core documents.
                      </p>
                    )}
                    {rows.map((row) => (
                      <DocChecklistRow
                        key={row.type}
                        type={row.type}
                        own={row.own}
                        reused={row.reused}
                        isUploading={uploadKey === `${app.id}::${row.type}`}
                        uploadingFile={uploadingFile}
                        scanStatus={scanStatus}
                        onStartUpload={() => startUpload(app.id, row.type)}
                        onCancelUpload={() => { setUploadKey(null); setUploadingFile(null); setScanStatus("idle"); }}
                      />
                    ))}
                    {extraDocs.map((d) => (
                      <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-[var(--sd-bg)] p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-slate-700">{d.name}</p>
                          <p className="text-[11px] text-slate-400">{d.type}</p>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => navigate(`/student/applications/${app.id}`)}
                      className="flex w-full items-center justify-center gap-1 py-1.5 text-[12.5px] font-medium text-slate-400"
                    >
                      View full application <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {applications.length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              <p className="text-sm font-medium text-slate-700">No applications yet</p>
              <p className="mt-1 text-xs text-slate-400">Apply to a program to see its document checklist here.</p>
              <button onClick={() => navigate("/student/search")} className="mt-3 text-[13px] font-semibold text-[var(--sd-ink)]">
                Explore universities
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
      />
    </div>
  );
}
