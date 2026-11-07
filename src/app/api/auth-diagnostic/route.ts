import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");

  if (permissionError || allowed !== true) {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.includes("auth-token"));

  return NextResponse.json(
    {
      proxyRan: request.headers.get("x-jinqaya-proxy") === "1",
      hasAuthCookie,
      hasVerifiedClaims: true,
      canManageCatalog: true,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
