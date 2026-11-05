import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.includes("auth-token"));

  let canManageCatalog = false;
  let permissionErrorCode: string | null = null;

  if (claims?.sub) {
    const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
    canManageCatalog = allowed === true;
    permissionErrorCode = permissionError?.code ?? null;
  }

  return NextResponse.json(
    {
      proxyRan: request.headers.get("x-jinqaya-proxy") === "1",
      hasAuthCookie,
      hasVerifiedClaims: Boolean(claims?.sub),
      canManageCatalog,
      authError: error?.message ?? null,
      permissionErrorCode,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
