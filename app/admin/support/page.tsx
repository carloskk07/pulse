import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin-authorization";
import { updateSupportCase } from "./actions";

export const metadata = { title: "Support Ops" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ state?: string }> };

type CaseRow = { id: string; email: string; category: string; subject: string; message: string; status: string; created_at: string; updated_at: string };

export default async function AdminSupportPage({ searchParams }: Props) {
  const params = await searchParams;
  const adminAccess = await getAdminAccess();
  if (adminAccess.status === "unauthenticated") redirect("/auth?next=/admin/support");
  if (adminAccess.status !== "authorized") notFound();

  const admin = createSupabaseAdminClient();
  const { data } = admin ? await admin.from("support_cases").select("id,email,category,subject,message,status,created_at,updated_at").order("created_at", { ascending: false }).limit(80) : { data: [] };
  const rows = (data ?? []) as CaseRow[];
  const open = rows.filter((row) => row.status === "open").length;
  const review = rows.filter((row) => row.status === "in_review").length;

  return <AppShell active="support-admin">
    <div className="admin-head"><div><span className="app-eyebrow">User operations</span><h1>Support queue</h1><p>Every case has a protocol, category and explicit lifecycle.</p></div><span className={`admin-badge ${open ? "setup" : ""}`}>{open ? `${open} OPEN` : "CLEAR"}</span></div>
    {params.state ? <div className={`claim-message ${params.state === "updated" ? "success" : "neutral"}`}>{params.state === "updated" ? "Case status updated." : "The case could not be updated."}</div> : null}
    <section className="admin-secondary-grid"><article><span>Open</span><strong>{open}</strong></article><article><span>In review</span><strong>{review}</strong></article><article><span>Loaded</span><strong>{rows.length}</strong></article></section>
    <section className="support-ops-list">{rows.length ? rows.map((row) => <article className={`support-ops-card status-${row.status}`} key={row.id}><div className="support-ops-head"><div><span className="app-eyebrow">{row.category} · {row.id.slice(0,8).toUpperCase()}</span><h2>{row.subject}</h2><small>{row.email} · {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}</small></div><span className="status-pill">{row.status.replace("_", " ")}</span></div><p>{row.message}</p><form action={updateSupportCase} className="support-ops-actions"><input type="hidden" name="id" value={row.id} /><label>Status<select name="status" defaultValue={row.status}><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><button className="button button-sm" type="submit">Update</button></form></article>) : <div className="empty-ledger">No support cases yet.</div>}</section>
  </AppShell>;
}
