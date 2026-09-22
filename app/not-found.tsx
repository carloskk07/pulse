import Link from "next/link";
import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export default function NotFound() {
  return (
    <main className="system-state-page">
      <header className="system-state-header shell">
        <PulsercuitBrand />
        <span>404 · Unknown path</span>
      </header>
      <section className="system-state-shell shell">
        <div className="system-state-copy">
          <span className="section-kicker">404</span>
          <h1>This page is not here.</h1>
          <p>The link may be outdated or incorrect. Return home and continue from there.</p>
          <div className="system-state-actions">
            <Link className="button" href="/">Return home</Link>
          </div>
        </div>
        <div className="system-state-visual" aria-hidden="true"><span>Back to safety</span></div>
      </section>
    </main>
  );
}
