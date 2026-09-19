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
          <h1>This path is not part of the circuit.</h1>
          <p>Nothing was changed. Return to Pulsercuit and continue from a known state.</p>
          <div className="system-state-actions">
            <Link className="button" href="/">Return home</Link>
          </div>
        </div>
        <div className="system-state-visual" aria-hidden="true"><span>Known state</span></div>
      </section>
    </main>
  );
}
