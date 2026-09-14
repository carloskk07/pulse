import Link from "next/link";
import { PulsercuitBrand } from "./pulsercuit-brand";

export function SiteHeader() {
  return (
    <header className="site-header shell">
      <PulsercuitBrand />
      <nav className="marketing-nav" aria-label="Primary navigation">
        <Link href="/#how">How it works</Link>
        <Link href="/#rewards">Rewards</Link>
        <Link href="/proof">Proof</Link>
        <Link href="/support">Help</Link>
      </nav>
      <div className="header-actions">
        <Link className="text-link" href="/auth?next=/dashboard">Sign in</Link>
        <Link className="button button-sm" href="/auth?next=/dashboard">Start free</Link>
      </div>
    </header>
  );
}
