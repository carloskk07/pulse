import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export default function AdminLoading() {
  return (
    <main className="system-state-page system-state-admin">
      <header className="system-state-header shell">
        <PulsercuitBrand />
        <span>Private operations</span>
      </header>
      <section className="system-state-shell shell">
        <div className="system-state-copy">
          <span className="section-kicker">Private operations</span>
          <h1>Loading operator truth.</h1>
          <p>Current operational evidence is being read. Missing data is not treated as approval.</p>
          <div className="system-state-progress" aria-hidden="true"><i /></div>
        </div>
        <div className="system-state-visual is-operator" aria-hidden="true"><span>Evidence first</span></div>
      </section>
    </main>
  );
}
