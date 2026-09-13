import Link from "next/link";
import { Brand } from "@/components/brand";
import { TurnstileField } from "@/components/turnstile-field";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupportCase } from "./actions";

export const metadata = { title: "Help & Support" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ state?: string; case?: string }> };

const messages: Record<string, string> = {
  created: "Your request was received. Keep the protocol for reference.",
  invalid: "Check the form and try again.",
  "invalid-email": "Enter a valid email address.",
  "verification-failed": "Human verification did not complete. Refresh and try again.",
  unavailable: "Support intake is temporarily unavailable. No request was recorded.",
};

export default async function SupportPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  let cases: Array<{ id: string; category: string; subject: string; status: string; created_at: string }> = [];
  if (user && supabase) {
    const { data } = await supabase.from("support_cases").select("id,category,subject,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
    cases = data ?? [];
  }

  return <main className="completion-page">
    <header className="completion-header shell"><Link href="/"><Brand /></Link><nav><Link href="/dashboard">Product</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></header>
    <section className="completion-hero shell"><span className="section-kicker">Help center</span><h1>Support with a traceable protocol.</h1><p>Reward, payout, account and privacy requests stay tied to a case so they can be checked against real product evidence.</p></section>
    <section className="completion-grid shell">
      <div className="completion-card support-form-card"><span className="app-eyebrow">Open a case</span><h2>Tell us what happened.</h2>
        {params.state ? <div className={`claim-message ${params.state === "created" ? "success" : "neutral"}`}>{messages[params.state] ?? "Support status updated."}{params.case ? ` Protocol: ${params.case.toUpperCase()}` : ""}</div> : null}
        <form action={createSupportCase} className="completion-form">
          {!user ? <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label> : <div className="completion-identity">Signed in as <strong>{user.email}</strong></div>}
          <label>Category<select name="category" defaultValue="earning" required><option value="earning">Earning / missing reward</option><option value="withdrawal">Withdrawal / payout</option><option value="account">Account / access</option><option value="privacy">Privacy & data</option><option value="other">Other</option></select></label>
          <label>Subject<input name="subject" required minLength={3} maxLength={120} placeholder="Short description" /></label>
          <label>Details<textarea name="message" required minLength={10} maxLength={4000} rows={7} placeholder="What happened, when, and any relevant reference." /></label>
          <TurnstileField action="support" /><button className="button button-lg" type="submit">Create support protocol</button>
        </form>
      </div>
      <aside className="completion-card"><span className="app-eyebrow">Common questions</span><h2>What to include</h2><div className="faq-list"><details><summary>Missing reward</summary><p>Include the offer name, approximate completion time and any visible provider reference.</p></details><details><summary>Withdrawal issue</summary><p>Include the destination type and the status shown in Wallet. Do not create repeated payout attempts while one is processing.</p></details><details><summary>Privacy request</summary><p>Choose Privacy & data for access, correction, processing information, objection or deletion requests where applicable.</p></details></div></aside>
    </section>
    {user ? <section className="completion-section shell"><div className="completion-section-head"><div><span className="app-eyebrow">Your cases</span><h2>Recent protocols</h2></div><Link href="/account" className="inline-action">Account & security</Link></div><div className="case-list">{cases.length ? cases.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><small>{item.category} · {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(item.created_at))}</small></div><span className="status-pill">{item.status.replace("_", " ")}</span></article>) : <div className="empty-ledger">No support cases yet.</div>}</div></section> : null}
    <footer className="completion-footer shell"><span>Reward Pulse</span><div><Link href="/privacy">Privacy</Link><Link href="/rewards-policy">Rewards policy</Link><Link href="/terms">Terms</Link></div></footer>
  </main>;
}
