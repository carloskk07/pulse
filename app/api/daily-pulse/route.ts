import { NextRequest, NextResponse } from "next/server";
import { getProductRouteHref } from "@/lib/route-semantics";

export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL(getProductRouteHref("home", "?claim=upgraded"), request.url), 303);
}
