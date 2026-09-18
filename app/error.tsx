"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="completion-page">
      <section className="completion-hero shell">
        <span className="section-kicker">Something did not load</span>
        <h1>Your live state is still protected.</h1>
        <p>PulseCircuit could not load this view. No financial action is inferred from an incomplete screen.</p>
        <button className="button" type="button" onClick={() => reset()}>Try again</button>
      </section>
    </main>
  );
}
