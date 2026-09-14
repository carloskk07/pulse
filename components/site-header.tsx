import Link from "next/link";
import { PulsercuitBrand } from "./pulsercuit-brand";

export function SiteHeader() {
  return (
    <header className="site-header shell pc-v5-header pc-luxe-header">
      <PulsercuitBrand />
      <nav className="marketing-nav" aria-label="Primary navigation">
        <Link href="/#how">How it works</Link>
        <Link href="/#share">Share</Link>
        <Link href="/proof">Proof</Link>
      </nav>
      <div className="header-actions">
        <Link className="text-link" href="/auth?next=/dashboard">Sign in</Link>
        <Link className="button button-sm pc-v5-primary" href="/auth?next=/dashboard">Enter the circuit</Link>
      </div>
    </header>
  );
}
