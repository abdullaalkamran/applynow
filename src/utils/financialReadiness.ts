// Shared by the student's Financial Readiness card and the counsellor's Journey-panel stage
// editor, so both show the same running count from the same cash-in date.

/** Whole days elapsed since the given YYYY-MM-DD (0 for today; null if unset/unparseable or in
 * the future). Compared on local calendar dates so "opened today" is 0 regardless of time of day. */
export function daysSinceCashIn(openingDate: string | undefined, now = new Date()): number | null {
  if (!openingDate) return null;
  const [y, m, d] = openingDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const opened = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((today.getTime() - opened.getTime()) / 86_400_000);
  return days < 0 ? null : days;
}

/** "42 days held" — a plain running count from the cash-in date, nothing about a target. */
export function daysHeldLabel(openingDate: string | undefined): string | null {
  const days = daysSinceCashIn(openingDate);
  if (days === null) return null;
  return days === 0 ? "Cash in today" : `${days} day${days === 1 ? "" : "s"} held`;
}
