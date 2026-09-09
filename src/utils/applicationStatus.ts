export type StatusTone = "blue" | "green" | "amber" | "rose";

export function applicationStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("offer") || s.includes("deposit paid")) return "green";
  if (s.includes("hold") || s.includes("rejected")) return "rose";
  if (s.includes("pending") || s.includes("requested")) return "amber";
  return "blue";
}
