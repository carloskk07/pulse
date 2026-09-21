import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";

export async function ContinuousPulsePanel() {
  const ecosystem = await getPulseEcosystemSnapshot();

  return (
    <section className="pc-v13-continuous-panel">
      <div>
        <span className="app-eyebrow">Continuous earning</span>
        <h2>Every hour can open another Pulse.</h2>
        <p>The product is built around cadence, not an arbitrary claim count. A genuine member can return through every hourly window while global funding and fraud controls protect the system.</p>
      </div>
      <div className="pc-v13-continuous-metrics">
        <span><small>Hourly windows</small><strong>Up to 24/day</strong></span>
        <span><small>Today</small><strong>{ecosystem.claimsToday} claimed</strong></span>
        <span><small>Rank</small><strong>{ecosystem.rank}</strong></span>
        <span><small>XP</small><strong>{ecosystem.xp}</strong></span>
      </div>
      <div className="pc-v13-continuous-actions">
        <Link href="/earn" className="button button-secondary">Earn between Pulses <ArrowUpRight /></Link>
        <Link href="/invite" className="inline-action">Grow Network <ArrowUpRight /></Link>
      </div>
    </section>
  );
}
