import { useEffect, useState } from "react";

/** True for a moment every `everyMs` while `active` — drives a "shake" class so a required-action card draws the eye after
 * the student has sat on the page for a while (first shake after `everyMs`, then again each interval). Off for anyone who
 * prefers reduced motion (the CSS also guards this, but there's no point running the timer). */
export function useAttentionShake(active: boolean, everyMs = 10000, shakeMs = 700): boolean {
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (!active || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let off: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setShaking(true);
      off = setTimeout(() => setShaking(false), shakeMs);
    }, everyMs);
    return () => { clearInterval(id); if (off) clearTimeout(off); setShaking(false); };
  }, [active, everyMs, shakeMs]);
  return shaking;
}
