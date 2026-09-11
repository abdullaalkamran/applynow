import type { Role } from "../types";

const KEY = "sd-admin-team-leads";

function loadLeadMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function persistLeadMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function getTeamLeadOverride(roleId: Role): string | undefined {
  return loadLeadMap()[roleId];
}

export function setTeamLead(roleId: Role, memberId: string) {
  const map = loadLeadMap();
  map[roleId] = memberId;
  persistLeadMap(map);
}

export function clearTeamLead(roleId: Role) {
  const map = loadLeadMap();
  delete map[roleId];
  persistLeadMap(map);
}
