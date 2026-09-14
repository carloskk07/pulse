import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const RETENTION_ATTRIBUTION_COOKIE = "pc_return_attribution";
export const RETENTION_ATTRIBUTION_MAX_AGE_SECONDS = 12 * 60 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EARLY_RETURN_TOLERANCE_MS = 2 * 60 * 60_000;
const RETURN_ATTRIBUTION_WINDOW_MS = 24 * 60 * 60_000;

type RetentionEventType = "reminder_exported" | "reminder_returned" | "pulse_completed";

type RetentionEventRow = {
  target_at: string;
  occurred_at?: string;
};

export type RetentionFunnel = {
  available: boolean;
  exported: number;
  returned: number;
  completed: number;
  returnRate: number;
  postReturnCompletionRate: number;
  endToEndRate: number;
  days: number;
};

export function cleanReminderId(value: string | null | undefined) {
  const candidate = value?.trim() ?? "";
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

async function insertRetentionEvent(userId: string, reminderId: string, eventType: RetentionEventType, targetAt: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const { error } = await admin.from("retention_events").insert({
    user_id: userId,
    reminder_id: reminderId,
    event_type: eventType,
    channel: "calendar",
    target_at: targetAt,
  });

  if (!error) return true;
  return error.code === "23505";
}

async function getPriorEvent(userId: string, reminderId: string, eventType: RetentionEventType): Promise<RetentionEventRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("retention_events")
    .select("target_at,occurred_at")
    .eq("user_id", userId)
    .eq("reminder_id", reminderId)
    .eq("event_type", eventType)
    .maybeSingle();

  if (error || !data?.target_at) return null;
  return { target_at: String(data.target_at), occurred_at: data.occurred_at ? String(data.occurred_at) : undefined };
}

export async function createReminderAttribution(userId: string, targetAt: string) {
  const target = new Date(targetAt);
  if (!userId || !Number.isFinite(target.getTime()) || target.getTime() <= Date.now()) return null;

  const reminderId = randomUUID();
  const recorded = await insertRetentionEvent(userId, reminderId, "reminder_exported", target.toISOString());
  return recorded ? reminderId : null;
}

export async function recordReminderReturn(userId: string, reminderId: string) {
  const cleanId = cleanReminderId(reminderId);
  if (!userId || !cleanId) return false;

  const exported = await getPriorEvent(userId, cleanId, "reminder_exported");
  if (!exported) return false;

  const targetMs = new Date(exported.target_at).getTime();
  if (!Number.isFinite(targetMs)) return false;

  const now = Date.now();
  if (now < targetMs - EARLY_RETURN_TOLERANCE_MS || now > targetMs + RETURN_ATTRIBUTION_WINDOW_MS) return false;

  return insertRetentionEvent(userId, cleanId, "reminder_returned", exported.target_at);
}

export async function recordAttributedPulseCompletion(userId: string, reminderId: string) {
  const cleanId = cleanReminderId(reminderId);
  if (!userId || !cleanId) return false;

  const returned = await getPriorEvent(userId, cleanId, "reminder_returned");
  if (!returned?.occurred_at) return false;

  const returnedAt = new Date(returned.occurred_at).getTime();
  if (!Number.isFinite(returnedAt) || Date.now() - returnedAt > RETENTION_ATTRIBUTION_MAX_AGE_SECONDS * 1000) return false;

  return insertRetentionEvent(userId, cleanId, "pulse_completed", returned.target_at);
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export async function getRetentionFunnel(days = 30): Promise<RetentionFunnel> {
  const admin = createSupabaseAdminClient();
  const boundedDays = Math.max(1, Math.min(90, Math.floor(days)));
  if (!admin) {
    return { available: false, exported: 0, returned: 0, completed: 0, returnRate: 0, postReturnCompletionRate: 0, endToEndRate: 0, days: boundedDays };
  }

  const from = new Date(Date.now() - boundedDays * 24 * 60 * 60_000).toISOString();
  const countEvent = (eventType: RetentionEventType) => admin
    .from("retention_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("occurred_at", from);

  const [exportedResult, returnedResult, completedResult] = await Promise.all([
    countEvent("reminder_exported"),
    countEvent("reminder_returned"),
    countEvent("pulse_completed"),
  ]);

  const available = !exportedResult.error && !returnedResult.error && !completedResult.error;
  const exported = Number(exportedResult.count ?? 0);
  const returned = Number(returnedResult.count ?? 0);
  const completed = Number(completedResult.count ?? 0);

  return {
    available,
    exported,
    returned,
    completed,
    returnRate: rate(returned, exported),
    postReturnCompletionRate: rate(completed, returned),
    endToEndRate: rate(completed, exported),
    days: boundedDays,
  };
}
