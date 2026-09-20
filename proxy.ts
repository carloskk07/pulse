import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/account", "/dashboard", "/earn", "/wallet", "/invite", "/admin"];
const authFreeMachinePrefixes = ["/api/health", "/api/public"];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public machine endpoints never consume user identity. Skipping SSR Auth here
  // removes an unnecessary JWT/JWKS/Auth hop from health and CDN-cacheable public
  // APIs and guarantees these responses cannot acquire refreshed auth cookies.
  if (authFreeMachinePrefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
