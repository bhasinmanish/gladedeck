"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export const TIMEOUT_STORAGE_KEY = "glade_session_timeout_min";
export const DEFAULT_TIMEOUT_MIN = 30;

const WARN_BEFORE_MS = 2 * 60 * 1000; // show warning 2 minutes before sign-out

function getTimeoutMs(): number {
  if (typeof window === "undefined") return DEFAULT_TIMEOUT_MIN * 60_000;
  const stored = localStorage.getItem(TIMEOUT_STORAGE_KEY);
  const minutes = stored ? parseInt(stored, 10) : DEFAULT_TIMEOUT_MIN;
  return (isNaN(minutes) ? DEFAULT_TIMEOUT_MIN : minutes) * 60_000;
}

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router    = useRouter();
  const supabase  = createClient();

  const lastActivity  = useRef(Date.now());
  const warningActive = useRef(false);

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

  useEffect(() => {
    const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

    function onActivity() {
      lastActivity.current = Date.now();
      if (warningActive.current) {
        warningActive.current = false;
        setShowWarning(false);
      }
    }

    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    const tick = setInterval(async () => {
      const timeoutMs  = getTimeoutMs();
      const elapsed    = Date.now() - lastActivity.current;
      const remaining  = timeoutMs - elapsed;

      if (remaining <= 0) {
        clearInterval(tick);
        EVENTS.forEach(e => window.removeEventListener(e, onActivity));
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      if (remaining <= WARN_BEFORE_MS) {
        setSecondsLeft(Math.ceil(remaining / 1000));
        if (!warningActive.current) {
          warningActive.current = true;
          setShowWarning(true);
        }
      } else if (warningActive.current) {
        warningActive.current = false;
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(tick);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function stayLoggedIn() {
    lastActivity.current  = Date.now();
    warningActive.current = false;
    setShowWarning(false);
  }

  async function signOutNow() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <>
      {children}

      {showWarning && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-xs mx-4 w-full text-center space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Session expiring
              </p>
              <div className="text-5xl font-bold font-mono tabular-nums">
                {mins}:{String(secs).padStart(2, "0")}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                You&apos;ll be signed out automatically due to inactivity.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={signOutNow}>
                Sign out
              </Button>
              <Button size="sm" className="flex-1" onClick={stayLoggedIn}>
                Stay logged in
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
