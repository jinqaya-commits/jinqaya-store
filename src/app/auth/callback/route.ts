import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") ?? "/admin/products";
  const nextPath =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/admin/products";

  const loginError = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, requestUrl.origin));

  if (!code) {
    return loginError("magic_link_invalid");
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return loginError("magic_link_expired");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await supabase.auth.signOut();
    return loginError("magic_link_session_failed");
  }

  const { data: allowed, error: roleError } = await supabase.rpc("can_manage_catalog");

  if (roleError || allowed !== true) {
    await supabase.auth.signOut();
    return loginError("admin_access_required");
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
