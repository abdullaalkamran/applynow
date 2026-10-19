import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { clearReloadGuard, reloadOnceForNewVersion } from "./components/ErrorBoundary";

// Vite fires this when a lazy screen's file can't be fetched (typically an old tab after a new deploy) — refresh once to pick up the new version.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault();
});
// The page itself loaded fine, so allow the next deploy to auto-refresh again.
window.addEventListener("load", () => setTimeout(clearReloadGuard, 5000));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
