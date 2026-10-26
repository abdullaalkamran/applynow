// The UnifinderAi logo — transparent PNGs, so it sits cleanly on any background.
export function Logo({ className = "h-7" }: { className?: string }) {
  return <img src="/brand/logo.png" alt="UnifinderAi" draggable={false} className={`w-auto select-none ${className}`} />;
}

/** The square "AI" tile — for places too small for the full wordmark. */
export function LogoMark({ className = "h-8" }: { className?: string }) {
  return <img src="/brand/mark.png" alt="UnifinderAi" draggable={false} className={`w-auto select-none ${className}`} />;
}
