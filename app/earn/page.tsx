import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ContinuousEarnHub } from "@/components/continuous-earn-hub";
import { DirectStartButton } from "@/components/direct-start-button";
import { ArrowUpRight, Shield, Spark } from "@/components/icons";
import { getRankedOpportunities, type RankedOpportunity } from "@/lib/opportunities";
import { getCurrentUserContext } from "@/lib/current-user-context";
import { formatUsdFromCredits, getRewardSnapshot } from "@/lib/reward-state";
import { getRewardEntryChannels } from "@/providers/registry";

export const metadata = { title: "Earn" };

type Props = { searchParams: Promise<{ direct?: string; claim?: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const sourcePulseClaimId = params.claim && UUID_RE.test(params.claim) ? params.claim : null;

  return (
    <AppShell active="earn" userLabel={state.signedIn ? state.userLabel : undefined}>
      <div className="app-page-head pc-luxe-turbo-head">
        <div>
          <span className="app-eyebrow">Earn · optional</span>
          <h1>More ways to earn between Pulses.</h1>
          <p>Pulse stays at the center. Missions, verified actions, cashback and partner routes add value without blocking the hourly faucet.</p>
        </div>
        <div className="balance-chip"><small>Vault</small><strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong></div>
      </div>

      <div className="pc-v10-turbo-criteria" aria-label="Earn ranking criteria">
        <span><small>01</small><strong>Reward</strong><b>What it is worth</b></span>
        <span><small>02</small><strong>Time</strong><b>How long it should take</b></span>
        <span><small>03</small><strong>Completion</strong><b>How clearly it can be confirmed</b></span>
      </div>

      {params.direct ? <div className="claim-message neutral">{directCopy[params.direct] ?? "Earning state changed before start."}</div> : null}

      <ContinuousEarnHub />

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
                ? "Ranked from reward, time and completion confidence."
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
            <DirectStartButton
              campaignId={best.externalId}
              sourcePulseClaimId={sourcePulseClaimId}
            />
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
            <p>Extra reward availability can change without affecting your Pulse history or Vault.</p>
          </div>
          <span className="status-pill"><Shield /> Optional by design</span>
        </aside>
      </section>

      {moreOptions.length ? (
        <details className="admin-panel intelligence-section pc-luxe-ranked-turbo">
          <summary><strong>More Turbo options</strong></summary>
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
                  <DirectStartButton
                    campaignId={item.externalId}
                    sourcePulseClaimId={sourcePulseClaimId}
                    compact
                    label="Start"
                    ariaLabel={"Start " + item.title}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </AppShell>
  );
}
