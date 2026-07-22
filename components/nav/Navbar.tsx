"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart2, LogOut, SlidersHorizontal, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { DashboardPreferences } from "@/components/dashboard/DashboardPreferences";
import { featureByRoute } from "@/lib/features";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard"    },
  { label: "Portfolio",    href: "/portfolio"    },
  { label: "Scanner",      href: "/scanner"      },
  { label: "Charts",       href: "/charts"       },
  { label: "Alerts",       href: "/alerts"       },
  { label: "Daily Review", href: "/daily-review" },
  { label: "Trade Log",    href: "/trade-log"    },
  { label: "Orders",       href: "/orders"       },
  { label: "Strategies",   href: "/strategies"   },
  { label: "Agents",       href: "/agents"       },
  { label: "Reports",      href: "/reports"      },
];

export function Navbar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [lockedRoutes, setLockedRoutes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/features")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.features) return;
        const routes = new Set<string>();
        NAV_ITEMS.forEach(item => {
          const def = featureByRoute(item.href);
          if (def && data.features[def.key]?.locked) routes.add(item.href);
        });
        setLockedRoutes(routes);
      })
      .catch(() => {});
  }, []);

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
            const isLocked = lockedRoutes.has(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {item.label}
                {isLocked && <Lock className="h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:block mr-1">
          {user.email}
        </span>
        {user.email === "manshabhasin9@gmail.com" && (
          <Link href="/admin" title="Admin portal">
            <Button variant="ghost" size="icon">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </Button>
          </Link>
        )}
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
