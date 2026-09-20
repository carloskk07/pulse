import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { updateHandle } from "./actions";

export const metadata = { title: "Account" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ state?: string }> };

const copy: Record<string, string> = {
  "profile-updated": "Profile updated.",
  "invalid-handle": "Use 3–24 letters, numbers, dots, dashes or underscores.",
  "handle-unavailable": "That handle is unavailable.",
  unavailable: "Account settings are temporarily unavailable.",
};

export default async function AccountPage({ searchParams }: Props) {
  const params = await searchParams;
  const { supabase, user } = await getCurrentUserContext();
  if (!supabase || !user) redirect("/auth?next=/account");

  const admin = createSupabaseAdminClient();
  const { data: profile } = admin
    ? await admin.from("profiles").select("handle,created_at").eq("id", user.id).maybeSingle()
    : { data: null };

  return <AppShell active="account" userLabel={profile?.handle || user.email?.split("@")[0] || "Member"}>
    <div className="app-page-head"><div><span className="app-eyebrow">Account</span><h1>Your account.</h1><p>Identity, support and privacy controls in one place.</p></div></div>
    {params.state ? <div className={`claim-message ${params.state === "profile-updated" ? "success" : "neutral"}`}>{copy[params.state] ?? "Account status updated."}</div> : null}
    <section className="completion-grid account-grid">
      <article className="completion-card"><span className="app-eyebrow">Profile</span><h2>Identity</h2><div className="account-facts"><div><small>Email</small><strong>{user.email}</strong></div><div><small>Member since</small><strong>{profile?.created_at ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(profile.created_at)) : "—"}</strong></div></div><form action={updateHandle} className="completion-form compact-form"><label>Handle<input name="handle" defaultValue={profile?.handle ?? ""} minLength={3} maxLength={24} placeholder="your-name" /></label><button className="button" type="submit">Save profile</button></form></article>
      <article className="completion-card"><span className="app-eyebrow">Help & privacy</span><h2>Get help or manage privacy requests.</h2><p>The Help Center keeps each request tied to your account and real product history.</p><div className="account-links"><Link href="/support" className="button button-secondary">Open Help Center</Link><Link href="/support?category=privacy" className="inline-action">Privacy request</Link></div></article>
    </section>
  </AppShell>;
}
