import { useEffect, useState } from "react";

// Matches Tailwind's `md` breakpoint — the same cut-off AppLayout uses to swap its sidebar for
// RoleBottomNav — so a page that branches its layout on this stays in step with the shell.
const QUERY = "(max-width: 767px)";

/** True on phone-width viewports. For pages whose narrow layout is a different component tree
 * (a card list instead of a table) rather than just different classes — rendering both and
 * hiding one with CSS would mount stateful children (edit panels, hooks) twice. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => (typeof window !== "undefined" ? window.matchMedia(QUERY).matches : false));

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return mobile;
}
