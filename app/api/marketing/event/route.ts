import { NextRequest, NextResponse } from "next/server";
import {
  cleanMarketingSessionId,
  createMarketingSessionId,
  isPublicMarketingEvent,
  MARKETING_SESSION_COOKIE,
  MARKETING_SESSION_MAX_AGE_SECONDS,
  recordMarketingEvent,
} from "@/lib/marketing-funnel";
import { isTrustedSameOriginMutation } from "@/lib/request-security";

export const dynamic = "force-dynamic";

type EventBody = {
  event?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return NextResponse.json({ error: "origin" }, { status: 403 });
  }

  let body: EventBody;
  try {
    body = await request.json() as EventBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isPublicMarketingEvent(body.event)) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  let sessionId = cleanMarketingSessionId(request.cookies.get(MARKETING_SESSION_COOKIE)?.value);
  const shouldSetCookie = !sessionId;
  if (!sessionId) sessionId = createMarketingSessionId();

  try {
    await recordMarketingEvent(sessionId, body.event, {
      utmSource: textValue(body.utmSource),
      utmMedium: textValue(body.utmMedium),
      utmCampaign: textValue(body.utmCampaign),
    });
  } catch {
    console.warn("PULSECIRCUIT_MARKETING_EVENT_FAILED");
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });

  if (shouldSetCookie) {
    response.cookies.set(MARKETING_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MARKETING_SESSION_MAX_AGE_SECONDS,
    });
  }

  return response;
}
