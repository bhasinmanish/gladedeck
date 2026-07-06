import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";

export async function GET() {
  // Verify requester is the admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // List all auth users
  const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(users.map(u => ({
    id:              u.id,
    email:           u.email,
    created_at:      u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    provider:        u.app_metadata?.provider ?? "email",
  })));
}
