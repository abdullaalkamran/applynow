import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { registerScroller } from "./syncCache";

// Every shell's routed content lives inside one persistent scrollable container — the <Outlet>
// swaps what's rendered inside it, but the container itself never remounts, so its scroll position
// silently carries over from whatever page was open before. Without this, navigating from partway
// down a list (e.g. a scrolled Explore Universities page) into a detail page opens that new page
// already scrolled down, not at its own top. Attach the returned ref to that scrollable element.
export function useScrollToTopOnNavigate<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const { pathname } = useLocation();
  // Registered so a cache-driven remount of the page can restore the scroll position (see syncCache.ts).
  useEffect(() => {
    registerScroller(ref.current);
    return () => registerScroller(null);
  }, []);
  useEffect(() => {
    ref.current?.scrollTo(0, 0);
  }, [pathname]);
  return ref;
}
