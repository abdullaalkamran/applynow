import { useLayoutEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "../utils/googleClientId";

/** Renders Google's own button when a real OAuth client is configured, and a plain disabled-looking
 * placeholder otherwise — so Login/Signup never has to know whether Google sign-in is wired up yet. */
export function GoogleSignInButton({ onCredential, onError }: { onCredential: (credential: string) => void; onError: () => void }) {
  // Google's button is a fixed-width iframe (200–400px): size it to the space it's given so it lines up with the fields above.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(200, Math.min(400, Math.floor(el.clientWidth))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div
        title="Set VITE_GOOGLE_CLIENT_ID (and the server's GOOGLE_CLIENT_ID) to enable this"
        className="w-full rounded-xl bg-[var(--sd-card)] px-3.5 py-2.5 text-center text-[12.5px] text-neutral-400 shadow-neu-inset-sm"
      >
        Google sign-in not configured yet
      </div>
    );
  }

  return (
    <div ref={box} className="flex w-full justify-center overflow-hidden rounded-xl">
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          if (credentialResponse.credential) onCredential(credentialResponse.credential);
          else onError();
        }}
        onError={onError}
        width={String(width)}
      />
    </div>
  );
}
