import type { CSSProperties, ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PulseCoreVisual } from "@/components/pulse-core-visual";
import {
  EarnSpectrumArtwork,
  ProgressOrbitArtwork,
  ReferralNetworkArtwork,
  RewardArtifact,
  VaultProgressArtwork,
} from "@/components/pulse-visuals";
import { SceneTelemetry } from "@/components/scene-telemetry";
import { ValueFlow } from "@/components/value-flow";
import { Check, Shield, Spark, Users, Wallet } from "@/components/icons";
import type { ProductExperience, ProductJourney } from "@/lib/product-experience";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dense visual fixture" };

type Scene = "reward" | "earn" | "wallet" | "progress" | "invite";
type Props = { searchParams: Promise<{ scene?: string; event?: string }> };

const sceneSet = new Set<Scene>(["reward", "earn", "wallet", "progress", "invite"]);

function journey(
  stage: ProductJourney["stage"],
  balance: string,
  payoutProgress: number,
  payoutState: ProductJourney["payoutState"],
  payoutLabel: string,
): ProductJourney {
  return { stage, balance, payoutProgress, payoutState, payoutLabel };
}

const experiences: Record<Scene, ProductExperience> = {
  reward: {
    surface: "reward",
    phase: "ready",
    event: "none",
    residue: "balance-funded",
    journey: journey("earn", "$24.875", 83, "building", "83% to target"),
  },
  earn: {
    surface: "earn",
    phase: "live",
    event: "none",
    residue: "balance-funded",
    journey: journey("earn", "$24.875", 83, "building", "83% to target"),
  },
  wallet: {
    surface: "balance",
    phase: "live",
    event: "none",
    residue: "balance-funded",
    journey: journey("balance", "$48.725", 97, "building", "97% to target"),
  },
  progress: {
    surface: "progress",
    phase: "live",
    event: "none",
    residue: "rank-circuit",
  },
  invite: {
    surface: "network",
    phase: "live",
    event: "none",
    residue: "network-active",
  },
};

function FixtureNote({ children }: { children: ReactNode }) {
  return <div className="pc-dense-fixture-note"><Shield />{children}</div>;
}

function RewardScene() {
  return (
    <div className="pc-v9-dashboard pc-dense-fixture" data-dense-scene="reward">
      <div className="app-page-head pulse-page-head pc-luxe-dashboard-head pc-v9-head">
        <div className="pc-v9-head-copy">
          <div className="pulse-line">Your rewards</div>
          <h1>Know what you can <em>earn next.</em></h1>
          <p>Your next reward, balance and payout progress stay visible in one place.</p>
        </div>
        <SceneTelemetry
          variant="reward"
          status="Ready"
          items={[
            { label: "Reward", value: "$0.001–$0.050", meta: "Variable reward" },
            { label: "Balance", value: "$24.875", meta: "$5.125 to payout" },
            { label: "Signal", value: "82/100", meta: "Circuit" },
          ]}
        />
      </div>

      <ValueFlow journey={experiences.reward.journey!} />
      <FixtureNote>Dense signed-in state · 187 claims · 19-day streak · payout building</FixtureNote>

      <section className="dashboard-hero hourly-pulse-stage pc-luxe-pulse-stage pc-v9-stage" aria-label="Dense reward state">
        <div className="daily-pulse-card hourly-pulse-card pc-luxe-pulse-chamber pc-v9-chamber state-ready">
          <div className="pc-v9-horizon" aria-hidden="true" />
          <div className="daily-pulse-copy pc-luxe-pulse-copy pc-v9-pulse-copy">
            <span className="status-pill status-lime"><Spark /> Reward ready</span>
            <h2>Your hourly reward is ready to reveal.</h2>
            <p>The current variable range is visible before you claim. Your balance and progress update only after settlement.</p>
            <button className="button button-light pulse-claim-button pc-luxe-claim pc-v9-primary-cta" type="button">Reveal reward</button>
          </div>

          <div className="pulse-core-panel pc-luxe-core-panel pc-v9-core-panel" aria-label="Live reward state">
            <div className="pc-dashboard-reward-art" aria-hidden="true">
              <RewardArtifact value="" eyebrow="" meta="" readout={false} compact />
            </div>
            <PulseCoreVisual state="ready" eyebrow="Hourly reward" caption="$0.001–$0.050 reward">
              <span className="pulse-core-word">READY</span>
            </PulseCoreVisual>
            <div className="pulse-core-meta">
              <div className="pulse-trust-mini"><Shield /><span>Circuit</span><b>Signal 82/100</b></div>
              <small className="pulse-rhythm-label">19-day return streak · 187 verified claims</small>
            </div>
          </div>

          <div className="pulse-integrity-rail pc-luxe-integrity pc-v9-integrity" aria-label="Reward principles">
            <span><i className="integrity-dot" />Rewards</span>
            <span><i className="integrity-dot" />Progress</span>
            <span><i className="integrity-dot" />Payout</span>
            <strong className="online">ACTIVE</strong>
          </div>
        </div>
      </section>

      <section className="app-section pc-luxe-momentum-section pc-v9-momentum">
        <div className="pc-v9-progress-deck">
          <article className="pc-v9-progress-card signal-card">
            <span className="app-eyebrow">Progress</span>
            <div className="pc-v9-progress-value"><strong>82</strong><span>/100</span></div>
            <h3>Circuit</h3>
            <p>19-day return streak · 187 verified claims</p>
          </article>
          <article className="pc-v9-progress-card vault-card">
            <span className="app-eyebrow">Balance</span>
            <div className="pc-v9-progress-value"><strong>83%</strong></div>
            <h3>$24.875</h3>
            <p>$5.125 remains to the current payout target.</p>
          </article>
          <article className="pc-v9-progress-card unlock-card">
            <span className="app-eyebrow">Referrals</span>
            <div className="pc-v9-progress-value"><strong>128</strong></div>
            <h3>Active network</h3>
            <p>37 referrals are waiting for first eligible activity.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

function EarnScene() {
  return (
    <div className="pc-dense-fixture" data-dense-scene="earn">
      <div className="app-page-head pc-luxe-turbo-head">
        <div className="pc-earn-head-copy">
          <span className="app-eyebrow">Extra rewards · optional</span>
          <h1>More ways to earn between faucet claims.</h1>
          <p>Compare tasks, verified actions, cashback and partner rewards by value and time.</p>
        </div>
        <div className="pc-earn-head-visual" aria-hidden="true"><EarnSpectrumArtwork /></div>
        <SceneTelemetry
          variant="earn"
          status="Best option"
          items={[
            { label: "Balance", value: "$24.875", meta: "Available value" },
            { label: "Options", value: "18", meta: "Ranked now" },
            { label: "Best time", value: "~4 min", meta: "Strong evidence" },
          ]}
        />
      </div>

      <ValueFlow journey={experiences.earn.journey!} />
      <FixtureNote>Dense signed-in state · 18 ranked routes · long reward labels</FixtureNote>

      <div className="pc-v10-turbo-criteria" aria-label="Earn ranking criteria">
        <span><small>01</small><strong>Reward</strong><b>What it is worth</b></span>
        <span><small>02</small><strong>Time</strong><b>How long it should take</b></span>
        <span><small>03</small><strong>Completion</strong><b>How clearly it can be confirmed</b></span>
      </div>

      <section className="drop-stage turbo-stage pc-luxe-turbo-stage drop-stage-protected">
        <article className="drop-card pc-luxe-best-turbo has-live-opportunity">
          <div className="drop-card-head">
            <span className="status-pill status-lime"><Spark /> Best option now</span>
            <div className="pulse-line protected">Funded before start</div>
          </div>
          <div className="pc-turbo-orb" aria-hidden="true" />
          <div className="drop-card-main">
            <h2>Complete a verified partner task with protected reward capacity.</h2>
            <p>Ranked from reward, expected time and completion confidence.</p>
          </div>
          <div className="drop-card-foot">
            <div className="drop-stat"><div><small>Reward</small><strong>$0.275</strong></div></div>
            <div className="drop-stat"><div><small>Expected time</small><strong>~4 min</strong></div></div>
            <div className="drop-stat"><div><small>Evidence</small><strong>Strong</strong></div></div>
          </div>
        </article>

        <aside className="pc-luxe-turbo-aside">
          <span className="app-eyebrow">Live choice</span>
          <h2>18 routes are ranked right now.</h2>
          <p>The hourly faucet remains independent. Extra routes appear only when they add useful value.</p>
          <div className="pc-dense-rank-stack">
            <span><b>01</b><strong>$0.275</strong><small>~4 min</small></span>
            <span><b>02</b><strong>$0.180</strong><small>~6 min</small></span>
            <span><b>03</b><strong>$0.125</strong><small>~3 min</small></span>
          </div>
        </aside>
      </section>
    </div>
  );
}

function WalletScene() {
  return (
    <div className="pc-dense-fixture" data-dense-scene="wallet">
      <div className="app-page-head pc-luxe-vault-head">
        <div>
          <span className="app-eyebrow">Balance & payout</span>
          <h1>Your money. Your next payout in view.</h1>
          <p>See your available reward value, how close you are to payout, and what happens after a withdrawal starts.</p>
        </div>
        <SceneTelemetry
          variant="wallet"
          status="Building"
          items={[
            { label: "Available", value: "$48.725", meta: "Current balance" },
            { label: "Payout", value: "97%", meta: "Toward target" },
            { label: "Target", value: "$50.000 · USDT", meta: "Current pack" },
          ]}
        />
      </div>

      <ValueFlow journey={experiences.wallet.journey!} />
      <FixtureNote>Dense signed-in state · payout nearly ready · transaction history populated</FixtureNote>

      <section className="wallet-balance-card pc-luxe-vault-balance pc-v3-vault-balance">
        <div className="pc-v3-vault-copy">
          <div className="wallet-big-icon"><Wallet /></div>
          <div>
            <span>Available</span>
            <strong>$48.725</strong>
            <small>48,725 credits</small>
            <div className="pc-v10-vault-meter">
              <div aria-hidden="true"><i style={{ width: "97%" }} /></div>
              <small>97% to payout target</small>
            </div>
          </div>
        </div>
        <div className="pc-v3-vault-visual" aria-hidden="true">
          <VaultProgressArtwork percent={97} value="$48.725" readout={false} />
        </div>
        <div className="payout-pack-label">
          <small>Payout target</small>
          <strong>$50.000 · USDT</strong>
        </div>
      </section>

      <section className="withdrawal-panel pc-luxe-vault-action">
        <div>
          <span className="app-eyebrow">Almost ready</span>
          <h2>$1.275 remains before the current payout target.</h2>
          <p>Your available balance stays untouched until a payout request is actually reserved.</p>
        </div>
        <button className="button button-light button-lg" type="button" disabled>Reach payout target first</button>
      </section>

      <div className="wallet-grid pc-luxe-vault-grid">
        <section className="transaction-card">
          <div className="app-section-head"><div><span className="app-eyebrow">History</span><h2>What moved your balance.</h2></div></div>
          {[
            ["Faucet reward", "Today · settled", "+$0.050"],
            ["Cashback confirmed", "Today · settled", "+$12.480"],
            ["Extra reward completed", "Yesterday · settled", "+$4.275"],
            ["Referral reward", "Yesterday · settled", "+$1.250"],
            ["Withdrawal fee", "2 days ago · settled", "−$0.250"],
          ].map(([label, meta, value]) => (
            <div className="transaction-row" key={label}>
              <span className="transaction-status positive"><Check /></span>
              <div><strong>{label}</strong><small>{meta}</small></div>
              <b className={value.startsWith("−") ? "neutral" : "positive"}>{value}</b>
            </div>
          ))}
        </section>
        <aside className="trust-card pc-luxe-vault-trust">
          <Shield />
          <span className="app-eyebrow">Payout state</span>
          <h3>Balance authority is current.</h3>
          <p>Target, available value and transaction history are intentionally dense here to stress the signed-in composition.</p>
        </aside>
      </div>
    </div>
  );
}

function ProgressScene() {
  return (
    <div className="pc-dense-fixture" data-dense-scene="progress">
      <div className="app-page-head pc-progress-head pc-luxe-momentum-head">
        <div>
          <span className="app-eyebrow">Progress</span>
          <h1>See what your activity has built.</h1>
          <p>Claims, return streaks and milestones turn verified activity into visible progress.</p>
        </div>
        <SceneTelemetry
          variant="progress"
          status="Circuit"
          items={[
            { label: "Signal", value: "94/100", meta: "Circuit" },
            { label: "Streak", value: "23d", meta: "Return rhythm" },
            { label: "Claims", value: "187", meta: "Verified" },
          ]}
        />
        <button className="button pc-v5-primary" type="button">Share progress</button>
      </div>

      <FixtureNote>Dense signed-in state · advanced rank · achievement-rich history</FixtureNote>

      <section className="pc-progress-hero pc-luxe-momentum-hero">
        <article className="pc-identity-card pc-luxe-prestige-card pc-v3-prestige-card is-live" style={{ "--pc-signal": "94%" } as CSSProperties}>
          <div className="pc-luxe-prestige-halo" aria-hidden="true" />
          <span className="pc-live-signal-trace" aria-hidden="true"><i /></span>
          <div className="pc-v3-progress-orbit" aria-hidden="true"><ProgressOrbitArtwork /></div>
          <div className="pc-identity-top"><span><Spark /> Current rank</span><b>Circuit</b></div>
          <div className="pc-luxe-rank-name">Circuit</div>
          <div className="pc-identity-score"><strong>94</strong><span>/100</span></div>
          <div className="pc-identity-meta">
            <span><small>Return streak</small><strong>23d</strong></span>
            <span><small>Claims</small><strong>187</strong></span>
            <span><small>Next mark</small><strong>Resonance</strong></span>
          </div>
        </article>

        <aside className="pc-visual-story pc-momentum-story">
          <div className="pc-visual-story-copy">
            <span className="app-eyebrow">Next circuit</span>
            <h2>Resonance is within reach.</h2>
            <p>Six more signal points complete the current rank path while the 23-day rhythm remains visible.</p>
            <div className="pc-v10-rank-preview" aria-label="Rank path">
              {["Spark", "Flow", "Rhythm", "Circuit", "Resonance"].map((rank, index) => (
                <span className={index <= 3 ? "reached" : ""} key={rank}><i>{index + 1}</i><strong>{rank}</strong></span>
              ))}
            </div>
          </div>
          <div className="pc-visual-story-flow" aria-hidden="true">
            <span>187 claims</span><i /><span>23d streak</span><i /><span>94 signal</span>
          </div>
        </aside>
      </section>

      <section className="pc-progress-cta pc-luxe-momentum-cta">
        <div>
          <span className="app-eyebrow">Share progress</span>
          <h2>Your current Circuit story is ready.</h2>
          <p>Shareable cards expose progress, never balance.</p>
        </div>
        <button className="button button-lg pc-v5-primary" type="button">Create progress card</button>
      </section>
    </div>
  );
}

function InviteScene() {
  return (
    <div className="pc-dense-fixture" data-dense-scene="invite">
      <div className="app-page-head pc-luxe-share-head">
        <div>
          <span className="app-eyebrow">Referrals</span>
          <h1>Invite friends. See the reward before you share.</h1>
          <p>Referral rewards are tied to verified eligible activity.</p>
        </div>
        <SceneTelemetry
          variant="invite"
          status="Growing"
          items={[
            { label: "Active", value: "128", meta: "Confirmed" },
            { label: "Waiting", value: "37", meta: "First activity" },
            { label: "Rewards", value: "$184.275", meta: "Net value" },
          ]}
        />
      </div>

      <FixtureNote>Dense signed-in state · large active network · long referral URL</FixtureNote>

      <section className="invite-hero-card pc-luxe-invite-hero">
        <div className="pc-invite-copy">
          <div className="invite-hero-icon"><Users /></div>
          <span className="app-eyebrow">Your invite link</span>
          <h2>Share your referral link.</h2>
          <div className="referral-box pc-luxe-referral-box"><code>https://pulsercuit.pro/r/CIRCUIT-7H4K9Q2M</code><button type="button">Copy</button></div>
          <p>After the first eligible activity is verified, the active referral rule determines the reward.</p>
        </div>
        <div className="pc-invite-visual-stage" aria-hidden="true">
          <ReferralNetworkArtwork active={128} waiting={37} />
        </div>
      </section>

      <section className="pc-luxe-share-stats">
        <article><small>Active</small><strong>128</strong><span>confirmed referrals</span></article>
        <article><small>Waiting</small><strong>37</strong><span>first activity pending</span></article>
        <article><small>Rewards</small><strong>$184.275</strong><span>net referral value</span></article>
      </section>

      <section className="pc-dense-network-depth">
        <article><small>Level 1</small><strong>128</strong><span>directly active</span></article>
        <article><small>Level 2</small><strong>46</strong><span>network activity</span></article>
        <article><small>Milestones</small><strong>4 / 4</strong><span>verified</span></article>
      </section>
    </div>
  );
}

const renderers: Record<Scene, () => ReactNode> = {
  reward: RewardScene,
  earn: EarnScene,
  wallet: WalletScene,
  progress: ProgressScene,
  invite: InviteScene,
};

const activeByScene: Record<Scene, string> = {
  reward: "home",
  earn: "earn",
  wallet: "wallet",
  progress: "progress",
  invite: "invite",
};

export default async function DenseStateVisualFixture({ searchParams }: Props) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host")?.toLowerCase() ?? "";
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase() ?? "";
  const effectiveHost = forwardedHost || host;
  const localVisualHost = effectiveHost.startsWith("127.0.0.1:") || effectiveHost.startsWith("localhost:");
  if (!localVisualHost) notFound();

  const params = await searchParams;
  const requested = params.scene as Scene | undefined;
  const scene: Scene = requested && sceneSet.has(requested) ? requested : "reward";
  const SceneView = renderers[scene];
  const eventCue = params.event === "reward-settled"
    ? {
      id: "visual-fixture:reward-settled",
      kind: "reward-settled" as const,
      kicker: "Verified reward",
      title: "Reward settled",
      value: "+$0.050",
      detail: "Local visual fixture for the authoritative event field.",
      markers: ["Balance $24.875", "Signal 82/100"],
    }
    : null;

  return (
    <AppShell active={activeByScene[scene]} userLabel="Dense member" experience={experiences[scene]} eventCue={eventCue}>
      <SceneView />
    </AppShell>
  );
}
