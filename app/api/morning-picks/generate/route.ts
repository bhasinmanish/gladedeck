import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const PYTHON_URL    = process.env.PYTHON_SERVICE_URL ?? "https://gladedeck-production.up.railway.app";
const SERVICE_SECRET = process.env.PYTHON_SERVICE_SECRET ?? "";
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL ?? "";

export const maxDuration = 90;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  if (!checkRateLimit(`morning-generate:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests — try again later" }, { status: 429 });
  }

  try {
    const res = await fetch(`${PYTHON_URL}/morning-agent/run`, {
      method: "POST",
      headers: { "X-Service-Secret": SERVICE_SECRET },
    });
    const text = await res.text();
    console.log("[morning-picks/generate] python status:", res.status, "body:", text.slice(0, 500));
    if (!res.ok) {
      return NextResponse.json({ error: `Agent error (${res.status}): ${text.slice(0, 200)}` }, { status: 500 });
    }
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[morning-picks/generate]", e);
    return NextResponse.json({ error: `Failed to reach agent: ${e instanceof Error ? e.message : e}` }, { status: 500 });
  }
}
