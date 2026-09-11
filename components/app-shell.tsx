import Link from "next/link";
import { Brand } from "./brand";
import { Bolt, Home, Users, Wallet } from "./icons";

const links = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/earn", label: "Earn", Icon: Bolt },
  { href: "/wallet", label: "Wallet", Icon: Wallet },
  { href: "/invite", label: "Invite", Icon: Users },
];

export function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Brand />
        <nav className="app-nav" aria-label="Application">
          {links.map(({ href, label, Icon }) => (
            <Link key={href} className={active === label.toLowerCase() ? "active" : ""} href={href}><Icon />{label}</Link>
          ))}
        </nav>
        <div className="sidebar-user"><span className="avatar">CF</span><div><strong>Demo member</strong><small>Trust level 1</small></div></div>
      </aside>
      <main className="app-content">{children}</main>
      <nav className="bottom-nav" aria-label="Mobile application navigation">
        {links.map(({ href, label, Icon }) => (
          <Link key={href} className={active === label.toLowerCase() ? "active" : ""} href={href}><Icon /><span>{label}</span></Link>
        ))}
      </nav>
    </div>
  );
}
