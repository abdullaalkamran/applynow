// Shared with Notifications so unread-thread state can't drift between the two screens.
export interface MessageThread {
  id: string;
  name: string;
  last: string;
  time: string;
  unread: boolean;
  ai?: boolean;
  color?: string;
}

export const MESSAGE_THREADS: MessageThread[] = [
  { id: "t1", name: "AI Counsellor", last: "Your bank statement was received — I'll flag it to your counsellor.", time: "2m", unread: true, ai: true },
  { id: "t2", name: "Admissions — Manchester", last: "We may request an additional reference letter.", time: "1h", unread: true, color: "bg-slate-500" },
  { id: "t3", name: "Counsellor — Sarah K.", last: "Great news on your offer! Let's discuss the deposit.", time: "Yesterday", unread: false, color: "bg-emerald-500" },
];
