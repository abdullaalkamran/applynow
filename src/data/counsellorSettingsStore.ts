export interface CounsellorSettings {
  emailNotifications: boolean;
  taskReminders: boolean;
  weeklyDigest: boolean;
}

const KEY = "staff-counsellor-settings";
const DEFAULTS: CounsellorSettings = { emailNotifications: true, taskReminders: true, weeklyDigest: false };

export function loadCounsellorSettings(): CounsellorSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<CounsellorSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveCounsellorSettings(settings: CounsellorSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}
