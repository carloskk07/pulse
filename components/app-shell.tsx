import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { PulsercuitBrand } from "./pulsercuit-brand";
import { Bolt, Home, Shield, Trend, Users, Wallet } from "./icons";

const links = [
  { id: "home", href: "/dashboard", label: "Pulse", Icon: Home },
  { id: "progress", href: "/progress", label: "Momentum", Icon: Trend },
  { id: "earn", href: "/earn", label: "Turbo", Icon: Bolt },
  { id: "wallet", href: "/wallet", label: "Vault", Icon: Wallet },
  { id: "invite", href: "/invite", label: "Invite", Icon: Users },
];

const adminLinks = [
  { id: "admin", href: "/admin", label: "Ops", Icon: Trend },
  { id: "faucetpay-admin", href: "/admin/faucetpay", label: "Payments", Icon: Wallet },
  { id: "support-admin", href: "/admin/support", label: "Support", Icon: Users },
  { id: "ads-admin", href: "/admin/ads", label: "Ads", Icon: Bolt },
  { id: "advanced", href: "/admin/advanced", label: "Advanced", Icon: Shield },
];

function initials(value: string) {
  return value.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PC";
}

function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const allowed = new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  return allowed.has(email.toLowerCase());
}

export async function AppShell({ children, active, userLabel }: { children: React.ReactNode; active: string; userLabel?: string | null }) {
  const { supabase, user } = await getCurrentUserContext();
  const suppliedLabel = userLabel?.trim();
  let label = suppliedLabel || "Demo member";

  if (!suppliedLabel && user && supabase) {
    const { data: profile } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle();
    label = profile?.handle || user.email?.split("@")[0] || "Member";
  }

  const admin = isAdminEmail(user?.email);
  const sidebarLinks = admin ? [...links, ...adminLinks] : links;
  const utilityMobileActive = ["account", "support", "proof", "ads"].includes(active) || (admin && adminLinks.some((link) => link.id === active));

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <PulsercuitBrand />
        <nav className="app-nav" aria-label="Application">
          {sidebarLinks.map(({ id, href, label: navLabel, Icon }) => (
            <Link key={href} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} href={href}><Icon />{navLabel}</Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initials(label)}</span>
          <div><strong>{label}</strong><small>{user ? "Signed in" : "Preview mode"}</small></div>
          <div className="sidebar-tools">
            <Link className={active === "account" ? "active" : ""} aria-current={active === "account" ? "page" : undefined} href={user ? "/account" : "/auth?next=/account"}>Account</Link>
            <Link className={active === "proof" ? "active" : ""} aria-current={active === "proof" ? "page" : undefined} href="/proof">Proof</Link>
            <Link className={active === "ads" ? "active" : ""} aria-current={active === "ads" ? "page" : undefined} href="/advertise">Advertise</Link>
            <Link className={active === "support" ? "active" : ""} aria-current={active === "support" ? "page" : undefined} href="/support">Help</Link>
          </div>
          {user ? <form action={signOut}><button className="sidebar-signout" type="submit">Sign out</button></form> : null}
        </div>
      </aside>
      <main className="app-content">{children}</main>
      <nav className="bottom-nav" aria-label="Mobile application navigation">
        {links.map(({ id, href, label: navLabel, Icon }) => (
          <Link key={href} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} href={href}><Icon /><span>{navLabel}</span></Link>
        ))}
        <details className="bottom-nav-more">
          <summary className={utilityMobileActive ? "active" : ""} aria-label="More navigation and account actions">
            <span className="bottom-nav-more-icon" aria-hidden="true">•••</span>
            <span>More</span>
          </summary>
          <div className="bottom-nav-menu">
            <div className="bottom-nav-menu-user">
              <span className="avatar">{initials(label)}</span>
              <div><strong>{label}</strong><small>{user ? "Signed in" : "Preview mode"}</small></div>
            </div>
            <Link className={active === "account" ? "active" : ""} aria-current={active === "account" ? "page" : undefined} href={user ? "/account" : "/auth?next=/account"}>Account</Link>
            <Link className={active === "proof" ? "active" : ""} aria-current={active === "proof" ? "page" : undefined} href="/proof">Proof</Link>
            <Link className={active === "ads" ? "active" : ""} aria-current={active === "ads" ? "page" : undefined} href="/advertise">Advertise</Link>
            <Link className={active === "support" ? "active" : ""} aria-current={active === "support" ? "page" : undefined} href="/support">Help</Link>
            {admin ? adminLinks.map(({ id, href, label: navLabel, Icon }) => (
              <Link key={href} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} href={href}><Icon />{navLabel}</Link>
            )) : null}
            {user ? <form action={signOut}><button type="submit">Sign out</button></form> : <Link href="/auth?next=/dashboard">Log in</Link>}
          </div>
        </details>
      </nav>
    </div>
  );
}
