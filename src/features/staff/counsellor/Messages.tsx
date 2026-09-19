import { Messenger } from "../../../components/Messenger";
import { BackButton } from "../../../components/ui";

export default function CounsellorMessages() {
  return (
    <div>
      <BackButton fallback="/staff/counsellor" />
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">Direct messages with your students, their agents and the rest of the case team.</p>
      </div>
      <Messenger />
    </div>
  );
}
