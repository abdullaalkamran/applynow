import { useNavigate } from "react-router-dom";
import { Bell, MessageCircle, FileText, RefreshCw } from "lucide-react";
import { BackButton } from "../../components/ui";
import { getInboxItems, markInboxItemRead, markAllInboxRead, type InboxNotification } from "../../data/inboxStore";

const ICON: Record<string, typeof Bell> = {
  comment_added: MessageCircle,
  status_changed: RefreshCw,
  document_added: FileText, document_requested: FileText, document_uploaded: FileText, document_reviewed: FileText,
};

function when(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** Counsellor / agent notifications: status changes, requested and uploaded documents, comments — everything the
 * server files in their inbox. `studentsPath` is where a notification opens (their student profile page). */
export default function InboxNotifications({ fallback, studentsPath }: { fallback: string; studentsPath: string }) {
  const navigate = useNavigate();
  const items = getInboxItems();
  const unread = items.filter((n) => !n.read).length;

  function open(n: InboxNotification) {
    markInboxItemRead(n.id);
    if (n.studentId) navigate(`${studentsPath}/${n.studentId}`);
  }

  return (
    <div className="max-w-2xl">
      <BackButton fallback={fallback} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
        {unread > 0 && <button onClick={markAllInboxRead} className="text-xs font-medium text-[var(--brand-600)]">Mark all read</button>}
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">You're all caught up.</p>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = ICON[n.type] ?? Bell;
            return (
              <button key={n.id} onClick={() => open(n)} className={`flex w-full items-start gap-3 rounded-xl border bg-white p-3.5 text-left ${n.read ? "border-slate-100" : "border-slate-300"}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13px] ${n.read ? "text-slate-600" : "font-semibold text-slate-900"}`}>{n.title}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{when(n.createdAt)}</span>
                  </span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.body}</span>}
                </span>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
