import { buildReturnReminderCalendar } from "@/lib/return-reminder";
import { getRewardSnapshot } from "@/lib/reward-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getRewardSnapshot();

  if (!state.signedIn || state.preview) {
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

  const calendar = buildReturnReminderCalendar(state.nextClaimAt);

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
