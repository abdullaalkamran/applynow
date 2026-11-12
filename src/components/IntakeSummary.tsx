// "Open: January, September · Closed: May" for the explore cards — open months in the normal text colour, closed in a soft red.
export function IntakeSummary({ open, closed, fallback }: { open: string[]; closed: string[]; fallback?: string }) {
  if (open.length === 0 && closed.length === 0) return fallback ? <>{`Open: ${fallback}`}</> : null;
  return (
    <>
      {open.length > 0 && `Open: ${open.join(", ")}`}
      {open.length > 0 && closed.length > 0 && " · "}
      {closed.length > 0 && <span className="text-red-400">Closed: {closed.join(", ")}</span>}
    </>
  );
}
