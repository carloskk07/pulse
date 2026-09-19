"use client";

import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="system-state-page">
      <header className="system-state-header shell">
        <PulsercuitBrand />
        <span>Protected state</span>
      </header>
      <section className="system-state-shell shell">
        <div className="system-state-copy">
          <span className="section-kicker">Something did not load</span>
          <h1>Your live state is still protected.</h1>
          <p>Pulsercuit could not load this view. No financial action is inferred from an incomplete screen.</p>
          <div className="system-state-actions">
            <button className="button" type="button" onClick={() => reset()}>Try again</button>
          </div>
        </div>
        <div className="system-state-visual is-error" aria-hidden="true"><span>State preserved</span></div>
      </section>
    </main>
  );
}
