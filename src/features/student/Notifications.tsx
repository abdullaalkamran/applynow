import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, MessageCircle, FileText, Sparkles } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";
import { getNotifications, type NotificationItem } from "../../utils/notifications";
import { markAllNotificationsRead, markNotificationRead } from "../../data/notificationsStore";

const ICON_BY_TYPE: Record<NotificationItem["type"], typeof Bell> = {
  message: MessageCircle,
  document: FileText,
  application: Bell,
};

const TONE_BY_TYPE: Record<NotificationItem["type"], string> = {
  message: "bg-[#F1EAFB] text-[#6D3FBF]",
  document: "bg-[#FDF0DC] text-[#B8791C]",
  application: "bg-[#E7EEFC] text-[#2955C4]",
};

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>(() => getNotifications());
  const unreadCount = items.filter((n) => !n.read).length;

  function open(item: NotificationItem) {
    markNotificationRead(item.id);
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    navigate(item.path, item.state ? { state: item.state } : undefined);
  }

  function markAllRead() {
    markAllNotificationsRead(items.map((n) => n.id));
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="min-h-full pb-8">
      <div className="lg:mx-auto lg:w-full lg:max-w-2xl">
        <MobileHeader
          title="Notifications"
          right={
            unreadCount > 0 ? (
              <button onClick={markAllRead} className="whitespace-nowrap text-[12px] font-medium text-[#2955C4]">
                Mark all read
              </button>
            ) : undefined
          }
        />
      </div>

      <div className="px-5 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10">
        {items.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-300 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <Bell size={22} />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">You're all caught up</p>
            <p className="mt-1 text-xs text-slate-400">No notifications right now.</p>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {items.map((n) => {
            const Icon = n.type === "message" && n.title === "AI Counsellor" ? Sparkles : ICON_BY_TYPE[n.type];
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 rounded-2xl p-3.5 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)] ${
                  n.read ? "bg-[var(--sd-card)]" : "bg-[var(--sd-card)] ring-1 ring-[#2955C4]/20"
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONE_BY_TYPE[n.type]}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[13px] ${n.read ? "font-medium text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</p>
                    {n.time && <span className="shrink-0 text-[11px] text-slate-400">{n.time}</span>}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.detail}</p>
                </div>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2955C4]" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
