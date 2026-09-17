import type { Viewport } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { FeedbackMessage } from "@/components/feedback-message";
import { TurnstileField } from "@/components/turnstile-field";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupportCase } from "./actions";

export const metadata = { title: "Help & Support" };
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#f5f7f4", colorScheme: "light" };

type Props = { searchParams: Promise<{ state?: string; case?: string; category?: string }> };

const messages: Record<string, string> = {
  created: "Your request was received. Keep the protocol for reference.",
  invalid: "Check the form and try again.",
  "invalid-email": "Enter a valid email address.",
  "verification-failed": "Human verification did not complete. Refresh and try again.",
  unavailable: "Support intake is temporarily unavailable. No request was recorded.",
};

const errorStates = new Set(["invalid", "invalid-email", "verification-failed", "unavailable"]);
const categories = new Set(["earning", "withdrawal", "account", "privacy", "other"]);

export default async function SupportPage({ searchParams }: Props) {
  const params = await searchParams;
  const defaultCategory = params.category && categories.has(params.category) ? params.category : "earning";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  let cases: Array<{ id: string; category: string; subject: string; status: string; created_at: string }> = [];
  if (user && supabase) {
    const { data } = await supabase.from("support_cases").select("id,category,subject,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
    cases = data ?? [];
  }

  return <main className="completion-page">
    <header className="completion-header shell"><Link href="/"><Brand /></Link><nav><Link href="/dashboard">Product</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></header>
    <section className="completion-hero shell"><span className="section-kicker">Pulsercuit help center</span><h1>Support with a traceable protocol.</h1><p>Pulse, payout, account and privacy requests stay tied to a case so they can be checked against real product evidence.</p></section>
    <section className="completion-grid shell">
      <div className="completion-card support-form-card"><span className="app-eyebrow">Open a case</span><h2>Tell us what happened.</h2>
        {params.state ? <FeedbackMessage tone={params.state === "created" ? "success" : errorStates.has(params.state) ? "error" : "neutral"}>{messages[params.state] ?? "Support status updated."}{params.case ? ` Protocol: ${params.case.toUpperCase()}` : ""}</FeedbackMessage> : null}
        <form action={createSupportCase} className="completion-form">
          {!user ? <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label> : <div className="completion-identity">Signed in as <strong>{user.email}</strong></div>}
          <label>Category<select name="category" defaultValue={defaultCategory} required><option value="earning">Pulse / missing reward</option><option value="withdrawal">Withdrawal / payout</option><option value="account">Account / access</option><option value="privacy">Privacy & data</option><option value="other">Other</option></select></label>
          <label>Subject<input name="subject" required minLength={3} maxLength={120} placeholder="Short description" /></label>
          <label>Details<textarea name="message" required minLength={10} maxLength={4000} rows={7} placeholder="What happened, when, and any relevant reference." /></label>
          <TurnstileField action="support" theme="light" /><button className="button button-lg" type="submit">Create support protocol</button>
        </form>
      </div>
      <aside className="completion-card support-circuit-card"><span className="app-eyebrow">Evidence first</span><h2>Give us the shortest path to the truth.</h2><div className="faq-list"><details><summary>Missing Pulse or Turbo reward</summary><p>Include the approximate time, the action you completed and any visible reference. We reconcile against authoritative claim or provider events.</p></details><details><summary>Withdrawal issue</summary><p>Include the destination type and the status shown in Wallet. Do not create repeated payout attempts while one is processing.</p></details><details><summary>Privacy request</summary><p>Choose Privacy & data for access, correction, processing information, objection or deletion requests where applicable.</p></details></div><div className="support-proof-note"><i /> Pulsercuit support never treats a screenshot alone as financial authority.</div></aside>
    </section>
    {user ? <section className="completion-section shell"><div className="completion-section-head"><div><span className="app-eyebrow">Your cases</span><h2>Recent protocols</h2></div><Link href="/account" className="inline-action">Account</Link></div><div className="case-list">{cases.length ? cases.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><small>{item.category} · {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(item.created_at))}</small></div><span className="status-pill">{item.status.replace("_", " ")}</span></article>) : <div className="empty-ledger">No support cases yet.</div>}</div></section> : null}
    <footer className="completion-footer shell"><span>Pulsercuit</span><div><Link href="/privacy">Privacy</Link><Link href="/rewards-policy">Rewards policy</Link><Link href="/terms">Terms</Link></div></footer>
  </main>;
}
