import { type NextRequest } from "next/server";
import { createReminderAttribution } from "@/lib/retention-attribution";
import { isTrustedSameOriginMutation } from "@/lib/request-security";
import { buildReturnReminderCalendar } from "@/lib/return-reminder";
import { getRewardSnapshot } from "@/lib/reward-state";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return new Response("Cross-origin reminder export was rejected.", {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const [state, supabase] = await Promise.all([getRewardSnapshot(), createSupabaseServerClient()]);

  if (!state.signedIn || state.preview || !supabase) {
    return new Response("Sign in is required to create a return reminder.", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (!state.pulseFundingReady) {
    return new Response("The reward rail is currently in safe standby, so no return reminder was created.", {
      status: 409,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (!state.nextClaimAt) {
    return new Response("There is no future Pulse eligibility window to schedule right now.", {
      status: 409,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Sign in is required to create a return reminder.", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const reminderId = await createReminderAttribution(user.id, state.nextClaimAt);
  const returnUrl = new URL(reminderId ? "/return" : "/dashboard", getCanonicalSiteUrl());
  if (reminderId) returnUrl.searchParams.set("rid", reminderId);

  const calendar = buildReturnReminderCalendar(state.nextClaimAt, returnUrl.toString(), reminderId);

  return new Response(calendar, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pulsercuit-return-reminder.ics"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}
