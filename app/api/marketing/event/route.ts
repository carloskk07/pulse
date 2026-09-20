import { NextRequest, NextResponse } from "next/server";
import {
  cleanMarketingEventLabel,
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
  eventLabel?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isLikelyAutomation(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  return ["headlesschrome", "lighthouse", "playwright", "puppeteer"].some((marker) => userAgent.includes(marker));
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return NextResponse.json({ error: "origin" }, { status: 403 });
  }

  if (isLikelyAutomation(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
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

  const eventLabel = body.event === "cta_click" ? cleanMarketingEventLabel(textValue(body.eventLabel)) : null;
  if (body.event === "cta_click" && !eventLabel) {
    return NextResponse.json({ error: "invalid_event_label" }, { status: 400 });
  }

  let sessionId = cleanMarketingSessionId(request.cookies.get(MARKETING_SESSION_COOKIE)?.value);
  const shouldSetCookie = !sessionId;
  if (!sessionId) sessionId = createMarketingSessionId();

  try {
    await recordMarketingEvent(sessionId, body.event, {
      utmSource: textValue(body.utmSource),
      utmMedium: textValue(body.utmMedium),
      utmCampaign: textValue(body.utmCampaign),
    }, {
      label: eventLabel,
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
