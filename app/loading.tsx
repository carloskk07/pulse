import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export default function Loading() {
  return (
    <main className="system-state-page">
      <header className="system-state-header shell">
        <PulsercuitBrand />
        <span>Loading account</span>
      </header>
      <section className="system-state-shell shell">
        <div className="system-state-copy">
          <span className="section-kicker">Just a moment</span>
          <h1>Loading your account.</h1>
          <p>Pulsercuit is loading your rewards, balance and account status. Values stay hidden until verified data is ready.</p>
          <div className="system-state-progress" aria-hidden="true"><i /></div>
        </div>
        <div className="system-state-visual is-loading" aria-hidden="true"><span>Loading</span></div>
      </section>
    </main>
  );
}
