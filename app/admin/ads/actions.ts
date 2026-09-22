"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reviewPulseAdCampaign } from "@/lib/pulse-ads";
import { getAdminAccess } from "@/lib/admin-authorization";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const access = await getAdminAccess();
  if (access.status === "unavailable") throw new Error("Admin auth unavailable");
  if (access.status !== "authorized") throw new Error("Unauthorized");
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
