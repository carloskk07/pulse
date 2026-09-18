import Link from "next/link";
import { Brand } from "@/components/brand";
import { TurnstileField } from "@/components/turnstile-field";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { createSupportCase } from "./actions";

export const metadata = { title: "Help & Support" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ state?: string; case?: string; category?: string }> };

const messages: Record<string, string> = {
  created: "Your request was received. Keep the reference number if you need to follow up.",
  invalid: "Check the form and try again.",
  "invalid-email": "Enter a valid email address.",
  "verification-failed": "Human verification did not complete. Refresh and try again.",
  unavailable: "Support intake is temporarily unavailable. No request was recorded.",
};

const categories = new Set(["earning", "withdrawal", "account", "privacy", "other"]);

export default async function SupportPage({ searchParams }: Props) {
  const params = await searchParams;
  const defaultCategory = params.category && categories.has(params.category) ? params.category : "earning";
  const { supabase, user } = await getCurrentUserContext();
  let cases: Array<{ id: string; category: string; subject: string; status: string; created_at: string }> = [];
  if (user && supabase) {
    const { data } = await supabase.from("support_cases").select("id,category,subject,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
    cases = data ?? [];
  }

  return <main className="completion-page">
    <header className="completion-header shell"><Link href="/"><Brand /></Link><nav><Link href="/dashboard">Product</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></header>
    <section className="completion-hero shell"><span className="section-kicker">Pulsercuit help center</span><h1>Help tied to a real case.</h1><p>Choose the problem, tell us what happened, and PulseCircuit keeps the request tied to the real account and product history.</p></section>
    <section className="completion-grid shell">
      <div className="completion-card support-form-card"><span className="app-eyebrow">Support request</span><h2>Tell us what happened.</h2>
        {params.state ? <div className={`claim-message ${params.state === "created" ? "success" : "neutral"}`}>{messages[params.state] ?? "Support status updated."}{params.case ? ` Reference: ${params.case.toUpperCase()}` : ""}</div> : null}
        <form action={createSupportCase} className="completion-form">
          {!user ? <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label> : <div className="completion-identity">Signed in as <strong>{user.email}</strong></div>}
          <label>Category<select name="category" defaultValue={defaultCategory} required><option value="earning">Pulse / missing reward</option><option value="withdrawal">Withdrawal / payout</option><option value="account">Account / access</option><option value="privacy">Privacy & data</option><option value="other">Other</option></select></label>
          <label>Subject<input name="subject" required minLength={3} maxLength={120} placeholder="Short description" /></label>
          <label>Details<textarea name="message" required minLength={10} maxLength={4000} rows={7} placeholder="What happened, when, and any relevant reference." /></label>
          <TurnstileField action="support" theme="light" /><button className="button button-lg" type="submit">Send support request</button>
        </form>
      </div>
      <aside className="completion-card support-circuit-card"><span className="app-eyebrow">Helpful details</span><h2>What helps us resolve it faster.</h2><div className="faq-list"><details><summary>Missing Pulse or Turbo reward</summary><p>Include the approximate time, the action you completed and any visible reference. We check the time and reference against the real reward history.</p></details><details><summary>Withdrawal issue</summary><p>Include the destination type and the status shown in Wallet. Do not create repeated payout attempts while one is processing.</p></details><details><summary>Privacy request</summary><p>Choose Privacy & data for access, correction, processing information, objection or deletion requests where applicable.</p></details></div><div className="support-proof-note"><i /> Screenshots can help explain a problem, but payment and reward status are checked against live records.</div></aside>
    </section>
    {user ? <section className="completion-section shell"><div className="completion-section-head"><div><span className="app-eyebrow">Your cases</span><h2>Recent requests</h2></div><Link href="/account" className="inline-action">Account</Link></div><div className="case-list">{cases.length ? cases.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><small>{item.category} · {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(item.created_at))}</small></div><span className="status-pill">{item.status.replace("_", " ")}</span></article>) : <div className="empty-ledger">No support cases yet.</div>}</div></section> : null}
    <footer className="completion-footer shell"><span>Pulsercuit</span><div><Link href="/privacy">Privacy</Link><Link href="/rewards-policy">Rewards policy</Link><Link href="/terms">Terms</Link></div></footer>
  </main>;
}
