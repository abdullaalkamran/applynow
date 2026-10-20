import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Clock3, CheckCircle2, FilePlus2 } from "lucide-react";
import { MobileHeader, DocChecklistRow, type ScanStatus, type UploadedDoc } from "../../components/ui/mobile";
import { DOCUMENTS, CURRENT_STUDENT_ID } from "../../data/mockData";
import { getAllApplications } from "../../data/applicationsStore";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { loadUploadedDocs, addUploadedDoc, deleteAppDoc } from "../../data/applicationDocsStore";
import { addCoreDoc, deleteCoreDoc } from "../../data/coreDocsStore";
import {
  buildChecklist, buildCoreChecklist, buildSupportingChecklist, coreDocTypes, supportingDocTypes, docMatchesType, academicProfileIncomplete, type ChecklistRow,
} from "../../utils/documentChecklist";
import { AddCoreDocumentButton } from "../../components/CoreDocumentCard";

const CORE_KEY = "core";

interface FlatRow extends ChecklistRow {
  scope: string; // CORE_KEY or an applicationId
  scopeLabel: string; // "Core Documents" or the university name
}

/** Everything but "Core Documents" gets its university appended to the label, so the same document
 * type required by two different applications (or a core type vs. a university-specific one that
 * happens to share a name) doesn't read as the same row in a flat, status-grouped list. */
function displayType(row: FlatRow): string {
  return row.scope === CORE_KEY ? row.type : `${row.type} — ${row.scopeLabel}`;
}

export default function Documents() {
  const navigate = useNavigate();
  const [uploadKey, setUploadKey] = useState<string | null>(null); // `${CORE_KEY | applicationId}::${type}`
  const [uploadingFile, setUploadingFile] = useState<UploadedDoc | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applications = getAllApplications().filter(
    (a) => a.studentId === CURRENT_STUDENT_ID && !["Withdrawn", "Rejected", "Deferred"].includes(a.status)
  );
  const universities = getAllUniversities();

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
      // The store itself uploads the real file bytes to the server (see coreDocsStore.ts /
      // applicationDocsStore.ts) — it no longer needs (or accepts) a pre-built blob: URL here.
      if (scope === CORE_KEY) addCoreDoc(CURRENT_STUDENT_ID, type, file);
      else addUploadedDoc(scope, type, file);
      window.setTimeout(() => { setUploadKey(null); setUploadingFile(null); setScanStatus("idle"); }, 600);
    }, 1200);
  }

  const coreRows = buildCoreChecklist(CURRENT_STUDENT_ID);
  const coreTypes = coreDocTypes();
  const flatCoreRows: FlatRow[] = coreRows.map((r) => ({ ...r, scope: CORE_KEY, scopeLabel: "Core Documents" }));
  // English test certificate, employment certificate / recommendation letters, bank documents and Statements of Purpose: useful
  // for applications but not needed to submit one, so they get their own "Additional documents" section instead of "Required".
  const supportingRows = buildSupportingChecklist(CURRENT_STUDENT_ID);
  const supportingTypes = supportingDocTypes(CURRENT_STUDENT_ID);
  const flatSupportingRows: FlatRow[] = supportingRows.map((r) => ({ ...r, scope: CORE_KEY, scopeLabel: "Additional Documents" }));

  const extraDocsByApp: { id: string; name: string; type: string; status: string }[] = [];
  const flatAppRows: FlatRow[] = applications.flatMap((app) => {
    // Falls back to an unresolved-university state (no logo/tone, no university-derived items)
    // rather than skipping the application entirely — a counsellor's ad-hoc document request
    // still needs to show up even when `app.university` doesn't match a catalog entry.
    const university = universities.find((u) => u.name === app.university);
    const linkedDocs = DOCUMENTS.filter((d) => d.studentId === CURRENT_STUDENT_ID && d.applicationId === app.id);
    const uploaded = loadUploadedDocs(app.id);
    const docs = [...linkedDocs, ...uploaded];
    const rows = buildChecklist(university, app.studentId, app.id, docs);
    extraDocsByApp.push(
      ...docs.filter((d) => !rows.some((r) => docMatchesType(d.name, r.type)) && !coreTypes.some((t) => docMatchesType(d.name, t)) && !supportingTypes.some((t) => docMatchesType(d.name, t)))
    );
    return rows.map((r) => ({ ...r, scope: app.id, scopeLabel: app.university }));
  });

  const allRows = [...flatCoreRows, ...flatSupportingRows, ...flatAppRows];
  const requiredRows = allRows.filter((r) => !r.own && !r.reused && !r.supporting);
  const additionalRows = allRows.filter((r) => r.supporting && !r.own && !r.reused);
  const pendingRows = allRows.filter((r) => r.own && r.own.status !== "verified");
  const verifiedRows = allRows.filter((r) => r.reused || r.own?.status === "verified");

  function renderRow(row: FlatRow) {
    return (
      <DocChecklistRow
        key={`${row.scope}::${row.type}`}
        type={displayType(row)}
        own={row.own}
        reused={row.reused}
        rejected={row.rejected}
        requested={row.requested}
        optional={row.supporting}
        isUploading={uploadKey === `${row.scope}::${row.type}`}
        uploadingFile={uploadingFile}
        scanStatus={scanStatus}
        onStartUpload={() => startUpload(row.scope, row.type)}
        onCancelUpload={() => { setUploadKey(null); setUploadingFile(null); setScanStatus("idle"); }}
        // A pending-review upload (anything not yet verified) can be deleted — real server rows only (they have an id).
        onDelete={row.own?.id && row.own.status !== "verified" ? () => (row.scope === CORE_KEY ? deleteCoreDoc(row.own!.id!) : deleteAppDoc(row.own!.id!)) : undefined}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="lg:mx-auto lg:w-full lg:max-w-4xl">
        <MobileHeader
          title="My Documents"
          right={<AddCoreDocumentButton variant="header" studentId={CURRENT_STUDENT_ID} existingTypes={[...coreRows, ...supportingRows].map((r) => r.type)} onAdded={() => {}} />}
        />
      </div>

      <div className="px-5 pb-6 lg:mx-auto lg:w-full lg:max-w-4xl lg:px-10">

        {applications.length === 0 && coreRows.length === 0 && (
          <div className="rounded-2xl border border-transparent bg-[var(--sd-card)] p-6 text-center shadow-neu">
            <p className="text-sm font-medium text-neutral-700">No applications yet</p>
            <p className="mt-1 text-xs text-neutral-400">Apply to a program to see its document checklist here.</p>
            <button onClick={() => navigate("/student/search")} className="mt-3 text-[13px] font-semibold text-[var(--sd-ink)]">
              Explore universities
            </button>
          </div>
        )}

        <div className="space-y-5">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm text-red-600">
                <AlertCircle size={13} />
              </span>
              <p className="text-[clamp(11px,3.1vw,13.5px)] font-semibold text-red-700">Required — not uploaded yet</p>
              <span className="ml-auto shrink-0 rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm px-2 py-0.5 text-[clamp(10px,2.8vw,12px)] font-semibold text-red-700">
                {requiredRows.length}
              </span>
            </div>
            {academicProfileIncomplete(CURRENT_STUDENT_ID) && (
              <p className="mb-2 rounded-xl bg-neutral-50 px-3 py-2 text-[11.5px] leading-relaxed text-neutral-500">
                Your academic profile isn't fully filled in yet, so we can't always tell exactly which
                transcript or certificate you need. If something's missing from the list below, add it yourself.
              </p>
            )}
            <div className="space-y-2">
              {requiredRows.length === 0 && (
                <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-3.5 text-[12.5px] text-neutral-400">
                  Nothing required right now — you're all caught up.
                </p>
              )}
              {requiredRows.map(renderRow)}
            </div>
          </section>

          {additionalRows.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm text-neutral-600">
                  <FilePlus2 size={13} />
                </span>
                <p className="text-[clamp(11px,3.1vw,13.5px)] font-semibold text-neutral-800">Additional documents</p>
                <span className="ml-auto shrink-0 rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm px-2 py-0.5 text-[clamp(10px,2.8vw,12px)] font-semibold text-neutral-700">
                  {additionalRows.length}
                </span>
              </div>
              <p className="mb-2 text-[11.5px] leading-snug text-neutral-500">
                Not needed to submit your application — add them when you have them. A university may ask for them later.
              </p>
              <div className="space-y-2">{additionalRows.map(renderRow)}</div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm text-amber-600">
                <Clock3 size={13} />
              </span>
              <p className="text-[clamp(11px,3.1vw,13.5px)] font-semibold text-amber-700">Pending review</p>
              <span className="ml-auto shrink-0 rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm px-2 py-0.5 text-[clamp(10px,2.8vw,12px)] font-semibold text-amber-700">
                {pendingRows.length}
              </span>
            </div>
            <div className="space-y-2">
              {pendingRows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-3.5 text-[12.5px] text-neutral-400">
                  Nothing awaiting review at the moment.
                </p>
              ) : (
                pendingRows.map(renderRow)
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm text-green-600">
                <CheckCircle2 size={13} />
              </span>
              <p className="text-[clamp(11px,3.1vw,13.5px)] font-semibold text-green-700">Uploaded &amp; verified</p>
              <span className="ml-auto shrink-0 rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm px-2 py-0.5 text-[clamp(10px,2.8vw,12px)] font-semibold text-green-700">
                {verifiedRows.length}
              </span>
            </div>
            <div className="space-y-2">
              {verifiedRows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-3.5 text-[12.5px] text-neutral-400">
                  Nothing verified yet.
                </p>
              ) : (
                verifiedRows.map(renderRow)
              )}
            </div>
          </section>

          {extraDocsByApp.length > 0 && (
            <section>
              <p className="mb-2 text-[13px] font-semibold text-neutral-900">Other documents on file</p>
              <div className="space-y-2">
                {extraDocsByApp.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-transparent bg-[var(--sd-card)] p-3.5 shadow-neu">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-neutral-700">{d.name}</p>
                      <p className="text-[11px] text-neutral-400">{d.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
