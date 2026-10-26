import { userScopedKey } from "../utils/userScope";

export type MeetingAction = "Join" | "Email" | "Prepare" | "View";
export type MeetingKind = "session" | "task";

export interface Meeting {
  id: string;
  time: string; // 24h "HH:MM"
  title: string;
  subtitle: string;
  studentId?: string;
  action: MeetingAction;
  kind: MeetingKind;
}

// No seeded sessions: the schedule is only what the counsellor has added themselves.
export const MEETINGS: Meeting[] = [];

const CUSTOM_KEY = "staff-custom-meetings";

function loadCustomMeetings(): Meeting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(userScopedKey(CUSTOM_KEY));
    return raw ? (JSON.parse(raw) as Meeting[]) : [];
  } catch {
    return [];
  }
}

/** The seeded meetings plus any the counsellor has scheduled this session, time-sorted. */
export function loadMeetings(): Meeting[] {
  return [...MEETINGS, ...loadCustomMeetings()].sort((a, b) => a.time.localeCompare(b.time));
}

export function addMeeting(input: Omit<Meeting, "id">): Meeting {
  const meeting: Meeting = { ...input, id: `mt-${Date.now().toString(36)}` };
  const custom = loadCustomMeetings();
  custom.push(meeting);
  if (typeof window !== "undefined") window.localStorage.setItem(userScopedKey(CUSTOM_KEY), JSON.stringify(custom));
  return meeting;
}

const DONE_KEY = "staff-meetings-done";

export function loadDoneMeetingIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(userScopedKey(DONE_KEY));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function markMeetingDone(id: string) {
  if (typeof window === "undefined") return;
  const ids = loadDoneMeetingIds();
  ids.add(id);
  window.localStorage.setItem(userScopedKey(DONE_KEY), JSON.stringify([...ids]));
}

export type MeetingStatus = { label: string; tone: "green" | "rose" | "slate" | "neutral" };

/** Computed against the real current time — a meeting reads "Online" while it's happening,
 * "Overdue" once it's passed and wasn't marked done, otherwise "In Xh". */
export function meetingStatus(meeting: Meeting, doneIds: Set<string>, now: Date = new Date()): MeetingStatus {
  if (doneIds.has(meeting.id)) return { label: "Done", tone: "neutral" };
  const [h, m] = meeting.time.split(":").map(Number);
  const meetingMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = meetingMinutes - nowMinutes;
  if (diff <= 15 && diff >= -30) return { label: "Online", tone: "green" };
  if (diff < -30) return { label: "Overdue", tone: "rose" };
  const hrs = Math.max(1, Math.round(diff / 60));
  return { label: `In ${hrs}h`, tone: "slate" };
}

export function formatMeetingTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
