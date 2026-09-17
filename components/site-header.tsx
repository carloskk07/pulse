import Link from "next/link";
import { PulsercuitBrand } from "./pulsercuit-brand";

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header className={`site-header pc-v6-header ${overlay ? "is-overlay" : "is-flow"}`}>
      <div className="shell pc-v6-shell pc-v6-header-inner">
        <PulsercuitBrand />
        <nav className="pc-v6-nav" aria-label="Primary navigation">
          <Link href="/#how">Pulse</Link>
          <Link href="/earn">Rewards</Link>
          <Link href="/#about">About</Link>
          <Link href="/proof">Proof</Link>
          <Link href="/#community">Community</Link>
        </nav>
        <div className="pc-v6-header-actions">
          <Link className="pc-v6-login" href="/auth?next=/dashboard">Log in</Link>
          <Link className="pc-v6-button compact primary" href="/auth?next=/dashboard">Enter the circuit <span>→</span></Link>
        </div>
      </div>
    </header>
  );
}
