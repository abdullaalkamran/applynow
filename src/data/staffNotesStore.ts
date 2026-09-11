const PREFIX = "staff-note:";

export function loadStaffNote(studentId: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(`${PREFIX}${studentId}`) ?? "";
}

export function saveStaffNote(studentId: string, note: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${PREFIX}${studentId}`, note);
}
