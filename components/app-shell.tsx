import Link from "next/link";
import { ViewTransition } from "react";
import { signOut } from "@/app/auth/actions";
import type { ProductExperience } from "@/lib/product-experience";
import { getAdminAllowlistStatus } from "@/lib/admin-authorization";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { PulsercuitBrand } from "./pulsercuit-brand";
import { SpatialAtmosphere } from "./spatial-atmosphere";
import { ProductInteractionLayer } from "./product-interaction-layer";
import { Bolt, Home, Shield, Spark, Trend, Users, Wallet } from "./icons";

const links = [
  { id: "home", href: "/dashboard", label: "Rewards", Icon: Home },
  { id: "progress", href: "/progress", label: "Progress", Icon: Trend },
  { id: "earn", href: "/earn", label: "Earn", Icon: Bolt },
  { id: "wallet", href: "/wallet", label: "Balance", Icon: Wallet },
  { id: "invite", href: "/invite", label: "Referrals", Icon: Users },
];

const routeOrder = new Map(links.map((link, index) => [link.id, index]));

function routeTransitionTypes(active: string, target: string) {
  const currentIndex = routeOrder.get(active);
  const targetIndex = routeOrder.get(target);
  if (currentIndex === undefined || targetIndex === undefined || currentIndex === targetIndex) return undefined;
  return [targetIndex > currentIndex ? "pc-forward" : "pc-back"];
}

const adminLinks = [
  { id: "admin", href: "/admin", label: "Ops", Icon: Trend },
  { id: "faucetpay-admin", href: "/admin/faucetpay", label: "Payments", Icon: Wallet },
  { id: "support-admin", href: "/admin/support", label: "Support", Icon: Users },
  { id: "ads-admin", href: "/admin/ads", label: "Ads", Icon: Bolt },
  { id: "direct-admin", href: "/admin/direct", label: "Direct", Icon: Spark },
  { id: "advanced", href: "/admin/advanced", label: "Advanced", Icon: Shield },
];

function initials(value: string) {
  return value.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PC";
}

export async function AppShell({
  children,
  active,
  userLabel,
  experience,
}: {
  children: React.ReactNode;
  active: string;
  userLabel?: string | null;
  experience?: ProductExperience;
}) {
  const { supabase, user } = await getCurrentUserContext();
  const suppliedLabel = userLabel?.trim();
  let label = suppliedLabel || "Demo member";

  if (!suppliedLabel && user && supabase) {
    const { data: profile } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle();
    label = profile?.handle || user.email?.split("@")[0] || "Member";
  }

  const admin = user ? (await getAdminAllowlistStatus(user.id)) === "authorized" : false;
  const utilityMobileActive = ["account", "support", "proof", "ads"].includes(active) || (admin && adminLinks.some((link) => link.id === active));

  return (
    <div className="app-frame" data-section={active} data-product-surface={experience?.surface} data-product-phase={experience?.phase} data-product-event={experience?.event}>
      <SpatialAtmosphere active={active} />
      <ProductInteractionLayer />
      <ViewTransition name="pc-route-topbar" share="pc-route-nav-anchor" default="none">
        <header className="app-topbar">
        <div className="app-topbar-inner">
          <PulsercuitBrand />
          <nav className="app-nav app-topbar-nav" aria-label="Application">
            {links.map(({ id, href, label: navLabel, Icon }) => (
              <Link key={href} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} href={href} transitionTypes={routeTransitionTypes(active, id)}>
                <Icon /><span>{navLabel}</span>
              </Link>
            ))}
          </nav>
          <details className="app-topbar-more">
            <summary aria-label="Account and more">
              <span className="avatar">{initials(label)}</span>
              <span className="app-topbar-user-copy"><strong>{label}</strong><small>{user ? "Signed in" : "Preview"}</small></span>
              <span className="app-topbar-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="app-topbar-menu">
              <div className="app-topbar-menu-head"><strong>{label}</strong><small>{user ? "Signed in" : "Preview mode"}</small></div>
              <Link className={active === "account" ? "active" : ""} aria-current={active === "account" ? "page" : undefined} href={user ? "/account" : "/auth?next=/account"}>Account</Link>
              <Link className={active === "proof" ? "active" : ""} aria-current={active === "proof" ? "page" : undefined} href="/proof">Proof</Link>
              <Link className={active === "ads" ? "active" : ""} aria-current={active === "ads" ? "page" : undefined} href="/advertise">Advertise</Link>
              <Link className={active === "support" ? "active" : ""} aria-current={active === "support" ? "page" : undefined} href="/support">Help</Link>
              {admin ? (
                <div className="app-topbar-admin-links">
                  <span>Operations</span>
                  {adminLinks.map(({ id, href, label: navLabel, Icon }) => (
                    <Link key={href} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} href={href}><Icon />{navLabel}</Link>
                  ))}
                </div>
              ) : null}
              {user ? <form action={signOut}><button type="submit">Sign out</button></form> : <Link href="/auth?next=/dashboard">Log in</Link>}
            </div>
          </details>
        </div>
        </header>
      </ViewTransition>
      <main className="app-content">{children}</main>
      <ViewTransition name="pc-route-bottom-nav" share="pc-route-nav-anchor" default="none">
        <nav className="bottom-nav" aria-label="Mobile application navigation">
        {links.map(({ id, href, label: navLabel, Icon }) => (
          <Link key={href} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} href={href} transitionTypes={routeTransitionTypes(active, id)}><Icon /><span>{navLabel}</span></Link>
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
      </ViewTransition>
    </div>
  );
}
