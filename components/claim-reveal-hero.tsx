import Link from "next/link";
import { ArrowUpRight, Check, Shield, Spark } from "@/components/icons";

export type ClaimRevealTone = "standard" | "boosted" | "top";

export function ClaimRevealHero({
  availableBalance,
  boostedReward,
  payoutRemaining,
  probabilityLabel,
  revealLabel,
  revealLead,
  rewardTone,
  rewardValue,
  signalStage,
  topReward,
  variableReward,
}: {
  availableBalance: string;
  boostedReward: boolean;
  payoutRemaining: string | null;
  probabilityLabel: string | null;
  revealLabel: string;
  revealLead: string;
  rewardTone: ClaimRevealTone;
  rewardValue: string;
  signalStage: string;
  topReward: boolean;
  variableReward: boolean;
}) {
  return (
    <section className={`pc-v8-victory pc-v8-reveal is-${rewardTone}-reward`} aria-labelledby="claim-victory-title" aria-live="polite">
      <div className="pc-v8-victory-aurora" aria-hidden="true" />
      <div className="pc-v8-victory-grid">
        <div className="pc-v8-victory-copy">
          <div className="pc-v8-victory-kicker">
            <span className="pc-v8-success-mark"><Check /></span>
            <span>{revealLabel}</span>
          </div>
          <span className="app-eyebrow">{variableReward ? "Your draw" : "Done"}</span>
          <h1 id="claim-victory-title">
            {variableReward
              ? <>You revealed.<br /><span className="pc-v8-reveal-value">+{rewardValue}</span></>
              : <>Reward added.<br />Your next claim is scheduled.</>}
          </h1>
          <p className="pc-v8-victory-lead">{revealLead}</p>

          <div className="pc-v8-reward-line">
            <div>
              <small>{variableReward ? "Revealed now" : "Added now"}</small>
              <strong>+{rewardValue}</strong>
              {probabilityLabel ? <span className="pc-v8-band-odds">{probabilityLabel}</span> : null}
            </div>
            <div><small>Available balance</small><strong>{availableBalance}</strong></div>
            {payoutRemaining !== null
              ? <div><small>To payout target</small><strong>{payoutRemaining}</strong></div>
              : null}
          </div>

          <div className="pc-v8-hero-actions">
            <Link href="/dashboard" className="button button-light">Track next claim <ArrowUpRight /></Link>
            <Link href="/wallet" className="pc-v8-text-action">View balance <ArrowUpRight /></Link>
          </div>

          <div className="pc-v8-proof-pills" aria-label="Claim integrity">
            {variableReward ? <span><Spark /> Variable draw settled</span> : null}
            {topReward ? <span><Spark /> Highest launch reward</span> : null}
            <span><Shield /> Funded reward</span>
            <span>Balance updated</span>
          </div>
        </div>

        <div className="pc-v8-vault-orbit" aria-label="Updated reward balance">
          <div className="pc-v8-orbit-ring">
            <div className="pc-v8-orbit-core">
              <span>{variableReward ? "This claim" : "Balance updated"}</span>
              <strong>{variableReward ? `+${rewardValue}` : availableBalance}</strong>
              <small>{variableReward
                ? topReward
                  ? "top launch reward"
                  : boostedReward
                    ? "above minimum band"
                    : "reward revealed"
                : "available now"}</small>
            </div>
          </div>
          <div className="pc-v8-orbit-meta">
            <span><b>{availableBalance}</b> balance now</span>
            <span><b>{signalStage}</b> current rank</span>
          </div>
        </div>
      </div>
    </section>
  );
}
