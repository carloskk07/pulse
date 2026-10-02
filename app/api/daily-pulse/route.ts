import { NextRequest, NextResponse } from "next/server";
import { isTrustedSameOriginMutation } from "@/lib/request-security";
import { getProductRouteHref } from "@/lib/route-semantics";

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return NextResponse.json(
      { status: "origin-rejected" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.redirect(
    new URL(getProductRouteHref("home", "?claim=upgraded"), request.url),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Pulse-Legacy-Route", "daily-pulse");
  return response;
}
