import Link from "next/link";
import { PulsercuitBrand } from "@/components/pulsercuit-brand";

export default function NotFound() {
  return (
    <main className="completion-page">
      <header className="completion-header shell"><PulsercuitBrand /></header>
      <section className="completion-hero shell">
        <span className="section-kicker">404</span>
        <h1>This path is not part of the circuit.</h1>
        <p>Return to PulseCircuit and continue from a known state.</p>
        <Link className="button" href="/">Return home</Link>
      </section>
    </main>
  );
}
