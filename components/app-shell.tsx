import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Brand } from "./brand";
import { Bolt, Home, Users, Wallet } from "./icons";

const links = [
  { id: "home", href: "/dashboard", label: "Home", Icon: Home },
  { id: "earn", href: "/earn", label: "Drops", Icon: Bolt },
  { id: "wallet", href: "/wallet", label: "Wallet", Icon: Wallet },
  { id: "invite", href: "/invite", label: "Invite", Icon: Users },
];

function initials(value: string) {
  return value.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RP";
}

export async function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  let label = "Demo member";
  let trustLevel = 1;

  if (user && supabase) {
    const { data: profile } = await supabase.from("profiles").select("handle,trust_level").eq("id", user.id).maybeSingle();
    label = profile?.handle || user.email?.split("@")[0] || "Member";
    trustLevel = Number(profile?.trust_level ?? 0);
  }

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Brand />
        <nav className="app-nav" aria-label="Application">
          {links.map(({ id, href, label: navLabel, Icon }) => (
            <Link key={href} className={active === id ? "active" : ""} href={href}><Icon />{navLabel}</Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{initials(label)}</span>
          <div><strong>{label}</strong><small>{user ? `Trust level ${trustLevel}` : "Preview mode"}</small></div>
          {user ? <form action={signOut}><button className="sidebar-signout" type="submit">Sign out</button></form> : null}
        </div>
      </aside>
      <main className="app-content">{children}</main>
      <nav className="bottom-nav" aria-label="Mobile application navigation">
        {links.map(({ id, href, label: navLabel, Icon }) => (
          <Link key={href} className={active === id ? "active" : ""} href={href}><Icon /><span>{navLabel}</span></Link>
        ))}
      </nav>
    </div>
  );
}
