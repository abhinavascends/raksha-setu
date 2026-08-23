"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/map", label: "Live Map", icon: "🗺️" },
  { href: "/dashboard/incidents", label: "Incidents", icon: "🚨" },
  { href: "/dashboard/resources", label: "Resources", icon: "🚤" },
  { href: "/dashboard/shelters", label: "Shelters", icon: "🏠" },
  { href: "/dashboard/assignments", label: "Assignments", icon: "📋" },
  { href: "/dashboard/simulation", label: "Simulation", icon: "🎬" },
];

export function Sidebar({
  userName,
  userRole,
}: {
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border)] px-5">
        <span className="text-xl">🛟</span>
        <div>
          <div className="text-sm font-bold leading-tight">RakshaSetu</div>
          <div className="text-xs text-muted">Control Room</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-[var(--color-accent)]"
                  : "text-muted hover:bg-gray-50 hover:text-foreground"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-border)] p-4">
        <div className="mb-2 truncate text-sm font-medium">{userName}</div>
        <div className="mb-3 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted">
          {userRole.replace("_", " ")}
        </div>
        <button
          onClick={signOut}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-gray-50 hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
