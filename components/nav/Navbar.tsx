"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart2, LogOut, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { User } from "@supabase/supabase-js";
import { DashboardPreferences } from "@/components/dashboard/DashboardPreferences";

interface NavItem {
  label: string;
  href: string;
  phase: 1 | 2 | 3;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",    phase: 1 },
  { label: "Scanner",     href: "/scanner",      phase: 1 },
  { label: "Charts",      href: "/charts",       phase: 1 },
  { label: "Alerts",      href: "/alerts",       phase: 1 },
  { label: "Daily Review",href: "/daily-review", phase: 2 },
  { label: "Trade Log",   href: "/trade-log",    phase: 2 },
  { label: "Strategies",  href: "/strategies",   phase: 3 },
  { label: "Reports",     href: "/reports",      phase: 3 },
];

export function Navbar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [prefsOpen, setPrefsOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="h-14 border-b border-border bg-card flex items-center px-4 gap-6 shrink-0">
      <Link href="/dashboard" className="flex items-center gap-2 mr-2">
        <BarChart2 className="h-5 w-5 text-primary" />
        <span className="font-bold text-sm">Glade Deck</span>
      </Link>

      <div className="flex items-center gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const locked = item.phase > 1;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {item.label}
              {locked && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 px-1 py-0 text-[10px] leading-4"
                >
                  P{item.phase}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground hidden sm:block mr-1">
          {user.email}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPrefsOpen(true)}
          title="Dashboard preferences"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <DashboardPreferences open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </nav>
  );
}
