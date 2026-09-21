"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reviewPulseAdCampaign } from "@/lib/pulse-ads";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Admin auth unavailable");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !adminEmails().has(user.email.toLowerCase())) throw new Error("Unauthorized");
}

function resultUrl(state: string) {
  return `/admin/ads?state=${encodeURIComponent(state)}`;
}

export async function reviewPulseAd(formData: FormData) {
  await requireAdmin();

  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  if (
    !UUID_RE.test(campaignId)
    || !["approve", "reject"].includes(decision)
    || (decision === "reject" && note.length < 3)
  ) {
    redirect(resultUrl("invalid"));
  }

  const result = await reviewPulseAdCampaign(campaignId, decision === "approve", note || null);
  const status = String(result.status ?? "failed");

  revalidatePath("/admin/ads");
  revalidatePath("/advertise");
  redirect(resultUrl(status));
}
