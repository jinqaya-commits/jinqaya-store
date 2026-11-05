import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  let canManageCatalog = false;
  let permissionErrorCode: string | null = null;

  if (user) {
    const { data, error } = await supabase.rpc("can_manage_catalog");
    canManageCatalog = data === true;
    permissionErrorCode = error?.code ?? null;
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.includes("auth-token"));

  return NextResponse.json(
    {
      proxyRan: request.headers.get("x-jinqaya-proxy") === "1",
      hasAuthCookie,
      hasServerSession: Boolean(user),
      canManageCatalog,
      authErrorCode: authError?.code ?? null,
      permissionErrorCode,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
