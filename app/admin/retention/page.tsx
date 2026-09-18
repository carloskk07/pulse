import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight } from "@/components/icons";
import { getRetentionFunnel } from "@/lib/retention-attribution";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Return Intelligence" };
export const dynamic = "force-dynamic";

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function RetentionAdminPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/retention");
  if (!user.email || !adminEmails().has(user.email.toLowerCase())) notFound();

  const funnel = await getRetentionFunnel(30);

  return (
    <AppShell active="retention">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Private retention evidence</span>
          <h1>Return Intelligence funnel</h1>
          <p>Measure whether an explicit calendar reminder creates a real return and a later authoritative Pulse. No synthetic engagement event is counted.</p>
        </div>
        <Link href="/admin" className="button">Operations <ArrowUpRight /></Link>
      </div>

      {!funnel.available ? <div className="preview-banner">Retention attribution is unavailable. The product continues to work, but no effectiveness claim should be made until telemetry is readable.</div> : null}

      <section className="admin-kpi-grid">
        <article className="admin-kpi primary">
          <span>Reminder exports</span>
          <strong>{funnel.exported.toLocaleString("en-US")}</strong>
          <small>factual .ics files generated · last {funnel.days} days</small>
        </article>
        <article className="admin-kpi">
          <span>Verified returns</span>
          <strong>{funnel.returned.toLocaleString("en-US")}</strong>
          <small>{percent(funnel.returnRate)} of exported reminders returned through their bound UUID</small>
        </article>
        <article className="admin-kpi positive">
          <span>Attributed Pulses</span>
          <strong>{funnel.completed.toLocaleString("en-US")}</strong>
          <small>{percent(funnel.postReturnCompletionRate)} of verified returns reached a successful Pulse</small>
        </article>
        <article className="admin-kpi">
          <span>End-to-end</span>
          <strong>{percent(funnel.endToEndRate)}</strong>
          <small>export → verified return → authoritative claim</small>
        </article>
      </section>

      <section className="admin-secondary-grid">
        <article><span>Return rate</span><strong>{percent(funnel.returnRate)}</strong></article>
        <article><span>Return → Pulse</span><strong>{percent(funnel.postReturnCompletionRate)}</strong></article>
        <article><span>Measurement window</span><strong>{funnel.days} days</strong></article>
        <article><span>Channel</span><strong>Calendar</strong></article>
      </section>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Attribution contract</span><h2>Evidence before infrastructure.</h2></div>
          <span className="admin-badge">V4.3</span>
        </div>
        <p className="admin-panel-note">Each exported reminder receives a random UUID. A return is accepted only for the authenticated owner of that UUID and only inside the bounded return window. A Pulse is attributed only after the existing authoritative claim RPC reports <strong>claimed</strong>. IDs expire from the browser after 12 hours and are never used to change reward eligibility, Trust, balance, Treasury, payout or risk.</p>
      </section>

      <section className="admin-decision-card">
        <span className="app-eyebrow">Decision rule</span>
        <h2>Do not add Web Push until this funnel proves calendar reminders are useful.</h2>
        <strong>{funnel.exported === 0 ? "NO DATA" : percent(funnel.endToEndRate)}</strong>
        <p>Push infrastructure becomes justified only after enough real reminder exports exist to compare return and completion behavior. Until then, Pulsercuit keeps the retention layer simple and observable.</p>
      </section>
    </AppShell>
  );
}
