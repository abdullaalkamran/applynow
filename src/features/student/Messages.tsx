import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { BackButton } from "../../components/ui/mobile";

const THREADS = [
  { id: "t1", name: "AI Counsellor", last: "Your bank statement was received — I'll flag it to your counsellor.", time: "2m", unread: true, ai: true },
  { id: "t2", name: "Admissions — Manchester", last: "We may request an additional reference letter.", time: "1h", unread: true, color: "bg-slate-500" },
  { id: "t3", name: "Counsellor — Sarah K.", last: "Great news on your offer! Let's discuss the deposit.", time: "Yesterday", unread: false, color: "bg-emerald-500" },
];

export default function Messages() {
  const navigate = useNavigate();

  return (
    <div className="px-5 pb-6 pt-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-slate-900">Messages</h1>
          <p className="mt-1 text-[13px] text-slate-500">AI guidance and direct lines to your team.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {THREADS.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(t.ai ? "/student/counsellor" : "#")}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm shadow-black/[0.03]"
          >
            {t.ai ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F1EAFB] text-[#6D3FBF]">
                <Sparkles size={18} />
              </div>
            ) : (
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${t.color}`}>
                {t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold text-slate-900">{t.name}</p>
                <span className="shrink-0 text-[11px] text-slate-400">{t.time}</span>
              </div>
              <p className="truncate text-xs text-slate-500">{t.last}</p>
            </div>
            {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--sd-teal)]" />}
          </button>
        ))}
      </div>
    </div>
  );
}
