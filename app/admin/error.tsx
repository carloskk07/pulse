"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="completion-page">
      <section className="completion-hero shell">
        <span className="section-kicker">Private operations</span>
        <h1>Operator data is unavailable.</h1>
        <p>No Treasury, payout or launch state was changed by this display failure.</p>
        <button className="button" type="button" onClick={() => reset()}>Retry safely</button>
      </section>
    </main>
  );
}
