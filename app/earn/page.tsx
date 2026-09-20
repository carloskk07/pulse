import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, Shield, Spark } from "@/components/icons";
import { getRankedOpportunities, type RankedOpportunity } from "@/lib/opportunities";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getRewardEntryChannels } from "@/providers/registry";

export const metadata = { title: "Turbo" };

type Props = { searchParams: Promise<{ direct?: string }> };

const directCopy: Record<string, string> = {
  "already-completed": "Already completed.",
  capacity_reserved: "Funded slots are temporarily reserved.",
  completion_cap_reached: "This extra reward reached its verified limit.",
  campaign_not_active: "This extra reward is not accepting starts right now.",
  campaign_ended: "This extra reward has ended.",
  not_started: "This extra reward has not opened yet.",
  "origin-rejected": "The protected start was rejected.",
  unavailable: "The protected start could not be reserved.",
  invalid: "That reward link is not valid.",
  "session-error": "The protected session could not be created safely.",
  "destination-error": "The destination failed the secure redirect check.",
  "service-unavailable": "Extra rewards are temporarily unavailable. Pulse is unaffected.",
};

function evidenceLabel(item: RankedOpportunity) {
  if (item.evidenceTier === "proven") return "Proven";
  if (item.evidenceTier === "strong") return "Strong";
  if (item.evidenceTier === "limited") return "Limited";
  if (item.evidenceTier === "new") return "New";
  return "Learning";
}

export default async function EarnPage({ searchParams }: Props) {
  const [state, userContext, ranked, params] = await Promise.all([
    getRewardSnapshot(),
    getCurrentUserContext(),
    getRankedOpportunities(24),
    searchParams,
  ]);
  const { user } = userContext;
  const channels = user ? getRewardEntryChannels(user.id) : [];
  const primaryChannel = channels[0] ?? null;
  const best = ranked[0] ?? null;
  const moreOptions = ranked.slice(1, 8);

  return (
    <AppShell active="earn" userLabel={state.signedIn ? state.userLabel : undefined}>
      <div className="app-page-head pc-luxe-turbo-head">
        <div>
          <span className="app-eyebrow">Turbo · optional</span>
          <h1>Extra rewards, ranked before you waste time.</h1>
          <p>Pulse remains the core loop. Turbo compares reward, time and verification evidence before putting an extra option in front of you.</p>
        </div>
        <div className="balance-chip"><small>Vault</small><strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong></div>
      </div>

      <div className="pc-v10-turbo-criteria" aria-label="Turbo ranking criteria">
        <span><small>01</small><strong>Reward</strong><b>What it is worth</b></span>
        <span><small>02</small><strong>Time</strong><b>How long it should take</b></span>
        <span><small>03</small><strong>Evidence</strong><b>How completion is verified</b></span>
      </div>

      {params.direct ? <div className="claim-message neutral">{directCopy[params.direct] ?? "Turbo state changed before start."}</div> : null}

      <section className={"drop-stage turbo-stage pc-luxe-turbo-stage " + (best?.pulseProtected ? "drop-stage-protected" : "")}>
        <article className="drop-card pc-luxe-best-turbo">
          <div className="drop-card-head">
            <span className="status-pill status-lime"><Spark /> {best ? "Best option now" : primaryChannel ? "Extra route available" : "No strong option"}</span>
            <div className={"pulse-line " + (best?.pulseProtected ? "protected" : "")}>{best?.pulseProtected ? "Funded before start" : "Optional"}</div>
          </div>

          <div className="pc-turbo-orb" aria-hidden="true" />

          <div className="drop-card-main">
            <h2>{best ? best.title : primaryChannel ? "Open the available extra-reward route." : "Nothing worth interrupting your Pulse for right now."}</h2>
            <p>{best?.pulseProtected
              ? "This reward reserves funded capacity before you leave PulseCircuit."
              : best
                ? "Ranked automatically from live value, time and verification evidence."
                : primaryChannel
                  ? "Use it only if you want an extra earning path."
                  : "Return to Pulse. The base experience remains independent."}</p>
          </div>

          <div className="drop-card-foot">
            <div className="drop-stat">
              <div><small>Reward</small><strong>{best ? formatUsdFromCredits(best.baseRewardCredits) : primaryChannel ? "Available" : "—"}</strong></div>
              <div><small>Time</small><strong>{best?.estimatedMinutes ? "~" + best.estimatedMinutes + " min" : "—"}</strong></div>
              <div><small>Verification</small><strong>{best ? (best.pulseProtected ? "Funded" : evidenceLabel(best)) : "—"}</strong></div>
            </div>
          </div>

          {best?.pulseProtected ? (
            <form action="/api/direct/start" method="post" className="direct-start-form">
              <input type="hidden" name="campaign" value={best.externalId} />
              <button className="button button-light direct-primary-action" type="submit">Start extra reward <ArrowUpRight /></button>
            </form>
          ) : primaryChannel ? (
            <a className="button button-light direct-primary-action" href={primaryChannel.href} target="_blank" rel="noopener sponsored">Open extra rewards <ArrowUpRight /></a>
          ) : (
            <Link className="button button-light direct-primary-action" href="/dashboard">Back to Pulse <ArrowUpRight /></Link>
          )}
        </article>

        <aside className="drop-aside pc-luxe-turbo-aside">
          <div>
            <span className="app-eyebrow">Core rule</span>
            <h3>Turbo never blocks Pulse.</h3>
            <p>External supply can disappear without changing your base reward history or Vault.</p>
          </div>
          <span className="status-pill"><Shield /> Optional by design</span>
        </aside>
      </section>

      {moreOptions.length ? (
        <details className="admin-panel intelligence-section pc-luxe-ranked-turbo">
          <summary><strong>More Turbo options</strong> · sorted automatically</summary>
          <div className="reward-list">
            {moreOptions.map((item, index) => (
              <article className={"reward-row intelligence-row " + (item.pulseProtected ? "direct-opportunity-row" : "")} key={item.id}>
                <div className="reward-row-main">
                  <span className="reward-rank">{String(index + 2).padStart(2, "0")}</span>
                  <div><strong>{item.title}</strong><small>{item.category} · {item.pulseProtected ? "Funded" : evidenceLabel(item)}</small></div>
                </div>
                <div className="reward-metric"><small>Reward</small><strong>{formatUsdFromCredits(item.baseRewardCredits)}</strong></div>
                <div className="reward-metric"><small>Time</small><strong>{item.estimatedMinutes ? item.estimatedMinutes + "m" : "—"}</strong></div>
                <div className="reward-metric"><small>Verification</small><strong>{item.pulseProtected ? "Protected" : Math.round(item.confidence * 100) + "%"}</strong></div>
                {item.pulseProtected ? (
                  <form action="/api/direct/start" method="post" className="direct-start-form compact">
                    <input type="hidden" name="campaign" value={item.externalId} />
                    <button className="direct-row-action" type="submit" aria-label={"Start " + item.title}>Start <ArrowUpRight /></button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </AppShell>
  );
}
