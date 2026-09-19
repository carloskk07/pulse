import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export default function Loading() {
  return (
    <main className="system-state-page">
      <header className="system-state-header shell">
        <PulsercuitBrand />
        <span>Live state</span>
      </header>
      <section className="system-state-shell shell">
        <div className="system-state-copy">
          <span className="section-kicker">Live state</span>
          <h1>Syncing your circuit.</h1>
          <p>Pulsercuit is loading the current account and reward state. No placeholder balance is invented while it loads.</p>
          <div className="system-state-progress" aria-hidden="true"><i /></div>
        </div>
        <div className="system-state-visual is-loading" aria-hidden="true"><span>Syncing</span></div>
      </section>
    </main>
  );
}
