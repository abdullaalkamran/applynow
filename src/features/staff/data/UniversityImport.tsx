// Data Management → Universities → "Import from URLs": the university flavour of ImportQueue.tsx.
// Paste each university's international / admissions / fees page (or homepage); the AI drafts
// the whole profile; review happens in UniversityForm (`?importId=`). The country is chosen
// here for the batch — pages rarely state it, and it has to match the catalog's country list.
import { useState } from "react";
import { getAllCountries } from "../../../data/countryRegistry";
import { getAllSubjects } from "../../../data/subjectsStore";
import {
  createUniversityImports, deleteUniversityImport, discardUniversityImport, listUniversityImports, runUniversityImport,
  type UniversityImportItem,
} from "../../../data/universityImportsStore";
import { ImportQueue, type QueueAdapter } from "./ImportQueue";

export default function DataUniversityImport() {
  const countries = getAllCountries().map((c) => c.name);
  const [country, setCountry] = useState("");

  const adapter: QueueAdapter<UniversityImportItem> = {
    title: "Import universities from URLs",
    subtitle:
      "One university per line. A single page rarely states everything, so put that university's international page, fees page and entry-requirements page on the same line separated by | — they're read together. The AI drafts the profile; you review and approve every one before it's added.",
    backLabel: "Back to Universities",
    backTo: { path: "/staff/data/universities" },
    urlPlaceholder: "https://www.example.ac.uk/international | https://www.example.ac.uk/international/fees | https://www.example.ac.uk/entry-requirements\nhttps://www.another.edu/admissions/international\n…one university per line, up to 50 at a time",
    batchOptions: (
      <label className="block text-xs font-medium text-slate-500">
        Country for this batch
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 sm:w-72">
          <option value="">Let the AI read it from each page</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="mt-1 block text-[11px] font-normal text-slate-400">Pick it when every link in the batch is from the same country — it's more reliable than reading it off the page.</span>
      </label>
    ),
    emptyText: "No university imports yet — paste some university page links above to start.",
    list: () => listUniversityImports(),
    create: (urls) => createUniversityImports(urls, country || undefined),
    run: (row, opts) => runUniversityImport(row.id, { ...opts, subjects: getAllSubjects(), countries }),
    discard: (row) => discardUniversityImport(row.id),
    remove: (row) => deleteUniversityImport(row.id),
    reviewPath: (row) => `/staff/data/universities/new?importId=${row.id}`,
    approvedPath: (row) => (row.approvedUniversityId ? `/staff/data/universities/${row.approvedUniversityId}` : undefined),
    summary: (row) => {
      const u = row.extracted?.university;
      if (!u?.name) return null;
      return {
        title: u.name,
        detail: (
          <>
            {[u.city, u.country].filter(Boolean).join(", ") || "location ?"} · {u.intakes?.length ? u.intakes.join("/") : "intakes ?"}
            {u.fees?.length ? ` · ${u.currencySymbol}${u.fees[0].amount.toLocaleString()}` : " · fees ?"} · {u.subjects?.length ?? 0} subjects
          </>
        ),
      };
    },
    reviewLabel: "Review & approve",
    openLabel: "Open university",
  };

  return <ImportQueue adapter={adapter} />;
}
