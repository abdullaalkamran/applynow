import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { resolveDateRange, type DateRange, type DateRangeKey } from "../utils/adminDashboard";

// The reporting period picked in the admin shell's top bar (see layouts/AdminShell.tsx) — it
// lives in the shell rather than the Dashboard page because the control sits in the header, but
// the numbers it scopes are rendered by the routed page underneath.
interface AdminRangeValue {
  rangeKey: DateRangeKey;
  setRangeKey: (key: DateRangeKey) => void;
  range: DateRange;
}

const AdminRangeContext = createContext<AdminRangeValue | null>(null);

export function AdminRangeProvider({ children }: { children: ReactNode }) {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("thisMonth");
  const value = useMemo(() => ({ rangeKey, setRangeKey, range: resolveDateRange(rangeKey) }), [rangeKey]);
  return <AdminRangeContext.Provider value={value}>{children}</AdminRangeContext.Provider>;
}

/** Falls back to "all time" outside the admin shell so a page can still render in isolation. */
export function useAdminRange(): AdminRangeValue {
  const ctx = useContext(AdminRangeContext);
  return ctx ?? { rangeKey: "all", setRangeKey: () => {}, range: { from: null, to: null } };
}
