import { NavLink } from "react-router-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export interface BottomNavEntry {
  label: string;
  path?: string;
  icon: LucideIcon;
  badge?: number;
}

/**
 * Student-style bottom tab bar for the other roles — shown only on phones (md:hidden), sitting
 * below the scrollable content just like Student's. Roles with more real (path-bearing) items
 * than fit get a trailing "More" tab that opens that shell's existing hamburger drawer instead of
 * inventing a second navigation surface.
 */
export function RoleBottomNav({ items, onMore }: { items: BottomNavEntry[]; onMore?: () => void }) {
  const withPaths = items.filter((i): i is BottomNavEntry & { path: string } => !!i.path);
  const primary = withPaths.slice(0, onMore ? 4 : 5);

  return (
    <div className="flex shrink-0 items-stretch justify-between border-t border-slate-200 bg-white px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden">
      {primary.map((item) => (
        <NavLink
          key={item.label}
          to={item.path}
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-1 ${isActive ? "text-[var(--sd-ink)]" : "text-slate-400"}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`relative flex h-8 w-8 items-center justify-center rounded-xl ${isActive ? "bg-[image:var(--sd-gradient)] text-white" : ""}`}>
                <item.icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                {!!item.badge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
      {onMore && (
        <button onClick={onMore} className="flex flex-1 flex-col items-center gap-1 py-1 text-slate-400">
          <MoreHorizontal size={21} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      )}
    </div>
  );
}
