"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart2, LogOut, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { DashboardPreferences } from "@/components/dashboard/DashboardPreferences";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard"    },
  { label: "Scanner",      href: "/scanner"      },
  { label: "Charts",       href: "/charts"       },
  { label: "Alerts",       href: "/alerts"       },
  { label: "Daily Review", href: "/daily-review" },
  { label: "Trade Log",    href: "/trade-log"    },
  { label: "Strategies",   href: "/strategies"   },
  { label: "Reports",      href: "/reports"      },
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
    <nav className="h-14 border-b border-border bg-card flex items-center px-4 gap-2 shrink-0">
      <Link href="/dashboard" className="flex items-center gap-2 mr-1 shrink-0">
        <BarChart2 className="h-5 w-5 text-primary" />
        <span className="font-bold text-sm">Glade Deck</span>
      </Link>

      <div className="flex-1 overflow-x-auto scrollbar-hide min-w-0">
        <div className="flex items-center gap-1 min-w-max">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
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
