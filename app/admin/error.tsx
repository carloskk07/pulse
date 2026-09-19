"use client";

import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="system-state-page system-state-admin">
      <header className="system-state-header shell">
        <PulsercuitBrand />
        <span>Private operations</span>
      </header>
      <section className="system-state-shell shell">
        <div className="system-state-copy">
          <span className="section-kicker">Private operations</span>
          <h1>Operator data is unavailable.</h1>
          <p>No Treasury, payout or launch state was changed by this display failure.</p>
          <div className="system-state-actions">
            <button className="button" type="button" onClick={() => reset()}>Retry safely</button>
          </div>
        </div>
        <div className="system-state-visual is-error" aria-hidden="true"><span>No approval inferred</span></div>
      </section>
    </main>
  );
}
