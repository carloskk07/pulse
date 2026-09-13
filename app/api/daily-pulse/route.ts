import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/dashboard?claim=upgraded", request.url), 303);
}
