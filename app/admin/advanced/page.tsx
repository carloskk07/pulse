import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAdminAccess } from "@/lib/admin-authorization";

export const metadata = { title: "Advanced Operations" };
export const dynamic = "force-dynamic";

export default async function AdvancedOperationsPage() {
  const adminAccess = await getAdminAccess();
  if (adminAccess.status === "unauthenticated") redirect("/auth?next=/admin/advanced");
  if (adminAccess.status !== "authorized") notFound();

  const tools = [
    {
      href: "/admin/product",
      title: "Readiness diagnostics",
      detail: "Inspect every product and release gate when the summary needs deeper investigation.",
    },
    {
      href: "/admin/retention",
      title: "Retention evidence",
      detail: "Review reminder attribution and return behavior without adding new infrastructure.",
    },
    {
      href: "/admin/leads",
      title: "Business leads",
      detail: "Review real inbound advertiser interest. This does not create a campaign or funding authority.",
    },
    {
      href: "/admin/prospects",
      title: "Prospect research",
      detail: "Maintain researched companies for a later growth phase without distracting the launch workflow.",
    },
  ];

  return (
    <AppShell active="advanced">
      <div className="admin-head">
        <div>
          <span className="app-eyebrow">Advanced operations</span>
          <h1>Deep tools stay out of the main workflow.</h1>
          <p>Use these surfaces only when the primary Ops, Payments or Support views point to a deeper investigation.</p>
        </div>
        <span className="admin-badge proof">SECONDARY</span>
      </div>

      <section className="admin-panel">
        <div className="app-section-head">
          <div><span className="app-eyebrow">Diagnostics & later-stage work</span><h2>Choose one reason to go deeper.</h2></div>
        </div>
        <div className="admin-secondary-grid">
          {tools.map((tool) => (
            <article key={tool.href}>
              <strong>{tool.title}</strong>
              <p>{tool.detail}</p>
              <Link className="button button-secondary" href={tool.href}>Open</Link>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
