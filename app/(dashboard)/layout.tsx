import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/nav/Navbar";
import { SessionGuard } from "@/components/session/SessionGuard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <SessionGuard>
      <div className="flex flex-col min-h-screen">
        <Navbar user={user} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </SessionGuard>
  );
}
