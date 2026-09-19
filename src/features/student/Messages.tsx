import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { BackButton } from "../../components/ui/mobile";
import { Messenger } from "../../components/Messenger";

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

      <button
        onClick={() => navigate("/student/counsellor")}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-3.5 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F1EAFB] text-[#6D3FBF]">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-900">AI Counsellor</p>
          <p className="truncate text-xs text-slate-500">Ask anything about your applications.</p>
        </div>
      </button>

      <div className="mt-4">
        <Messenger />
      </div>
    </div>
  );
}
