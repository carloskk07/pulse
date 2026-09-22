"use client";

import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="system-state-page">
      <header className="system-state-header shell">
        <PulsercuitBrand />
        <span>Account protected</span>
      </header>
      <section className="system-state-shell shell">
        <div className="system-state-copy">
          <span className="section-kicker">Something did not load</span>
          <h1>This view could not load.</h1>
          <p>Your account data and balance have not been changed. Try loading the page again.</p>
          <div className="system-state-actions">
            <button className="button" type="button" onClick={() => reset()}>Try again</button>
          </div>
        </div>
        <div className="system-state-visual is-error" aria-hidden="true"><span>Nothing changed</span></div>
      </section>
    </main>
  );
}
