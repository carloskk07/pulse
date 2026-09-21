import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BusinessLead = {
  id: string;
  company: string;
  contactName: string;
  workEmail: string;
  website: string | null;
  objective: string;
  budgetRange: string;
  targetCountries: string;
  estimatedActions: number | null;
  productInterest: string;
  status: string;
  source: string;
  message: string;
  nextActionAt: string | null;
  operatorNote: string | null;
  createdAt: string;
};

export type BusinessLeadSnapshot = {
  total: number;
  newCount: number;
  qualifiedCount: number;
  recent: BusinessLead[];
};

export async function getBusinessLeadSnapshot(): Promise<BusinessLeadSnapshot> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { total: 0, newCount: 0, qualifiedCount: 0, recent: [] };

  const [{ count: total }, { count: newCount }, { count: qualifiedCount }, { data }] = await Promise.all([
    admin.from("business_leads").select("id", { count: "exact", head: true }),
    admin.from("business_leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("business_leads").select("id", { count: "exact", head: true }).in("status", ["qualified", "contacted", "pilot"]),
    admin.from("business_leads")
      .select("id,company,contact_name,work_email,website,objective,budget_range,target_countries,estimated_actions,product_interest,status,source,message,next_action_at,operator_note,created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return {
    total: total ?? 0,
    newCount: newCount ?? 0,
    qualifiedCount: qualifiedCount ?? 0,
    recent: (data ?? []).map((row) => ({
      id: String(row.id),
      company: String(row.company),
      contactName: String(row.contact_name),
      workEmail: String(row.work_email),
      website: row.website ? String(row.website) : null,
      objective: String(row.objective),
      budgetRange: String(row.budget_range),
      targetCountries: String(row.target_countries ?? ""),
      estimatedActions: row.estimated_actions == null ? null : Number(row.estimated_actions),
      productInterest: String(row.product_interest ?? "pulse_direct"),
      status: String(row.status),
      source: String(row.source ?? "business_page"),
      message: String(row.message ?? ""),
      nextActionAt: row.next_action_at ? String(row.next_action_at) : null,
      operatorNote: row.operator_note ? String(row.operator_note) : null,
      createdAt: String(row.created_at),
    })),
  };
}
