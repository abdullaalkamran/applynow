import { useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { MobileHeader, SkylineArt } from "../../components/ui/mobile";
import { APPLICATIONS, UNIVERSITIES } from "../../data/mockData";
import type { AppStatus } from "../../types";

const STEPS = ["Application Submitted", "Under Review", "Offer", "Acceptance", "CAS", "Visa Application", "Enrolment"];

function pipelineIndex(status: AppStatus): number {
  if (["Draft", "Profile Incomplete", "Documents Pending", "Ready for Review"].includes(status)) return 0;
  if (["Eligibility Review", "Application Preparing", "Ready to Submit", "Submitted"].includes(status)) return 0;
  if (["University Review", "Additional Documents Requested"].includes(status)) return 1;
  if (["Offer Received", "Offer Conditions Pending"].includes(status)) return 2;
  if (["Deposit Pending", "Deposit Paid"].includes(status)) return 3;
  if (["CAS/COE Pending", "CAS/COE Issued"].includes(status)) return 4;
  if (["Visa Preparation", "Visa Submitted", "Visa Decision"].includes(status)) return 5;
  if (status === "Enrolled") return 6;
  return 1;
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const application = APPLICATIONS.find((a) => a.id === id) ?? APPLICATIONS[0];
  const university = UNIVERSITIES.find((u) => u.name === application.university);
  const currentIdx = pipelineIndex(application.status);

  return (
    <div className="min-h-full pb-8">
      <MobileHeader title="My Application" />

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
            <SkylineArt tone={university?.tone ?? "violet"} className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-slate-900">{application.course}</p>
            <p className="truncate text-xs text-slate-400">{application.university}</p>
            <p className="mt-0.5 text-xs text-slate-400">{application.intake} Intake</p>
          </div>
        </div>

        <div className="mt-5">
          {STEPS.map((label, i) => {
            const done = i < currentIdx;
            const current = i === currentIdx;
            return (
              <div key={label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      done
                        ? "bg-[var(--sd-teal)] text-white"
                        : current
                        ? "border-2 border-[var(--sd-ink)] bg-white text-[var(--sd-ink)]"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {done ? <Check size={15} /> : ""}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-0.5 flex-1 ${done ? "bg-[var(--sd-teal)]" : "bg-slate-200"}`} style={{ minHeight: 28 }} />
                  )}
                </div>
                <div className="pb-7">
                  <p className={`text-[13px] font-medium ${current ? "text-[var(--sd-ink)]" : done ? "text-slate-700" : "text-slate-400"}`}>
                    {label}
                  </p>
                  {i === 0 && <p className="text-xs text-slate-400">12 Oct 2025</p>}
                  {current && <p className="text-xs font-medium text-[var(--sd-ink)]">In Progress</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-[#E7EEFC] p-4">
          <p className="text-[13px] font-semibold text-[#1B2C57]">Current Status</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#3A4B76]">
            Your application is being reviewed by the university. We'll notify you once there's an update.
          </p>
        </div>
      </div>
    </div>
  );
}
