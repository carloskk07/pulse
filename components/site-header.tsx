import Link from "next/link";
import { Brand } from "./brand";

export function SiteHeader() {
  return (
    <header className="site-header shell">
      <Brand />
      <nav className="marketing-nav" aria-label="Primary navigation">
        <Link href="#how">How it works</Link>
        <Link href="#rewards">Rewards</Link>
        <Link href="#trust">Trust</Link>
      </nav>
      <div className="header-actions">
        <Link className="text-link" href="/dashboard">Sign in</Link>
        <Link className="button button-sm" href="/dashboard">Start earning</Link>
      </div>
    </header>
  );
}
