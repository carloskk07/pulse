import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const protectedPrefixes = ["/account", "/dashboard", "/earn", "/wallet", "/invite", "/admin"];
const authFreeMachinePrefixes = ["/api/health", "/api/public", "/api/marketing"];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (matchesPrefix(pathname, "/visual-smoke-fixture")) {
    const host = request.headers.get("host")?.toLowerCase() ?? "";
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase() ?? "";
    const effectiveHost = forwardedHost || host;
    const localVisualHost = effectiveHost.startsWith("127.0.0.1:") || effectiveHost.startsWith("localhost:");
    if (!localVisualHost) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
  }

  // Public machine endpoints never consume user identity. Skipping SSR Auth here
  // removes an unnecessary JWT/JWKS/Auth hop from health and CDN-cacheable public
  // APIs and guarantees these responses cannot acquire refreshed auth cookies.
  if (authFreeMachinePrefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
    return NextResponse.next({ request });
  }

  const config = getSupabasePublicConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const hasValidIdentity = !claimsError && typeof claims?.sub === "string" && claims.sub.length > 0;
  const isProtected = protectedPrefixes.some((prefix) => matchesPrefix(pathname, prefix));

  if (isProtected && !hasValidIdentity) {
    const authUrl = request.nextUrl.clone();
    authUrl.pathname = "/auth";
    authUrl.search = "";
    authUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(authUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/health|api/public|api/marketing|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
