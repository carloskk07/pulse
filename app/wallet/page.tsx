import { AppShell } from "@/components/app-shell";
import { Check, Shield, Wallet } from "@/components/icons";
import { TurnstileField } from "@/components/turnstile-field";
import { WithdrawalPassPanel } from "@/components/withdrawal-pass-panel";
import { getWalletPresentation } from "@/lib/experience-presentation";
import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";
import { formatUsdFromCredits } from "@/lib/reward-state";
import { getWalletState } from "@/lib/wallet-state";
import { getFaucetPayPackConfig } from "@/providers/faucetpay";

export const metadata = { title: "Vault" };

type Props = { searchParams: Promise<{ withdraw?: string }> };
const withdrawalCopy: Record<string, string> = {
  paid: "Payment complete.",
  processing: "Your payout is processing safely.",
  held: "Your payout is safely reserved while a review finishes.",
  insufficient: "You have not reached the current payout target yet.",
  "already-processing": "A payout is already in progress.",
  "invalid-destination": "FaucetPay could not verify that destination.",
  "provider-temporary": "FaucetPay is temporarily unavailable. Your balance did not change.",
  "verification-failed": "Verification failed. Try again.",
  "verification-not-configured": "Withdrawal verification is temporarily unavailable.",
  "payout-not-configured": "Withdrawals are temporarily unavailable. Your balance is safe.",
  "pilot-restricted": "Withdrawals are opening gradually. Your balance remains available.",
  "service-not-configured": "The payout service is temporarily unavailable.",
  "free-pass-used": "Your fee-free withdrawal was already used in the current 24-hour window. Extra withdrawals remain locked until expanded payout authority is active.",
  "reserve-failed": "The payout could not continue. Your balance remains protected.",
  failed: "The payout failed and the reserved credits were restored.",
};

function compactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function maskDestination(value: string) {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 2)}•••@${domain}`;
  }
  if (value.length <= 8) return `${value.slice(0, 2)}•••`;
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export default async function WalletPage({ searchParams }: Props) {
  const [wallet, ecosystem, params] = await Promise.all([
    getWalletState(),
    getPulseEcosystemSnapshot(),
    searchParams,
  ]);
  const {
    state,
    rows,
    activeWithdrawal,
    withdrawalPilotAllowed,
    readProofReady,
    sendScopeProofReady,
  } = wallet;
  const payout = getFaucetPayPackConfig();
  const payoutCredits = payout.ready && payout.amountCredits ? Number(payout.amountCredits) : null;
  const turnstileReady = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
  const serviceReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const activePackMatches = Boolean(
    activeWithdrawal
    && payout.ready
    && payout.amountCredits === activeWithdrawal.amount_credits
    && payout.amountSmallestUnits === activeWithdrawal.payout_amount_units
    && payout.asset === activeWithdrawal.asset,
  );
  const recoveryAuthorityReady = Boolean(
    activeWithdrawal
    && activeWithdrawal.status !== "held"
    && withdrawalPilotAllowed
    && turnstileReady
    && serviceReady
    && process.env.FAUCETPAY_SCOPED_KEY?.trim()
    && sendScopeProofReady
    && (activeWithdrawal.status === "submitted" || (readProofReady && activePackMatches)),
  );
  const canWithdraw = Boolean(
    !activeWithdrawal
    && state.signedIn
    && withdrawalPilotAllowed
    && payout.ready
    && payoutCredits
    && readProofReady
    && sendScopeProofReady
    && turnstileReady
    && serviceReady
    && (ecosystem.freeWithdrawalAvailable || ecosystem.extraWithdrawalsEnabled)
    && state.availableCredits >= payoutCredits + (ecosystem.freeWithdrawalAvailable ? 0 : ecosystem.extraWithdrawalFeeCredits),
  );
  const missingCredits = payoutCredits ? Math.max(0, payoutCredits - state.availableCredits) : null;
  const payoutPercent = payoutCredits ? Math.max(0, Math.min(100, Math.round((state.availableCredits / payoutCredits) * 100))) : 0;
  const presentation = getWalletPresentation({
    signedIn: state.signedIn,
    preview: state.preview,
    payoutPackReady: payout.ready && turnstileReady && serviceReady,
    payoutCredits,
    availableCredits: state.availableCredits,
    readProofReady,
    sendScopeProofReady,
    payoutPilotAllowed: withdrawalPilotAllowed,
    activeWithdrawalStatus: activeWithdrawal?.status ?? null,
    recoveryAuthorityReady,
    formattedMissingAmount: missingCredits !== null && missingCredits > 0 ? formatUsdFromCredits(missingCredits) : null,
  });
  const payoutPackLabel = activeWithdrawal
    ? `${formatUsdFromCredits(activeWithdrawal.amount_credits)} · ${activeWithdrawal.asset}`
    : payout.ready && payoutCredits
      ? payout.display || formatUsdFromCredits(payoutCredits)
      : "Preparing";

  return (
    <AppShell active="wallet" userLabel={state.signedIn ? state.userLabel : undefined}>
      <div className="app-page-head pc-luxe-vault-head">
        <div>
          <span className="app-eyebrow">Vault</span>
          <h1>Your balance. Your next payout in view.</h1>
          <p>See what is available, how close the target is, and what happens after withdrawal starts.</p>
        </div>
      </div>

      {params.withdraw ? (
        <div className={`claim-message ${params.withdraw === "paid" ? "success" : "neutral"}`}>
          {withdrawalCopy[params.withdraw] ?? "Payment state updated."}
        </div>
      ) : null}

      <section className="wallet-balance-card pc-luxe-vault-balance">
        <div className="wallet-big-icon"><Wallet /></div>
        <div>
          <span>Available</span>
          <strong>{state.preview ? "—" : formatUsdFromCredits(state.availableCredits)}</strong>
          {!state.preview ? <small>{state.availableCredits.toLocaleString("en-US")} credits</small> : null}
          {!state.preview && payoutCredits ? (
            <div className="pc-v10-vault-meter">
              <div aria-hidden="true"><i style={{ width: `${payoutPercent}%` }} /></div>
              <small>{payoutPercent >= 100 ? "Payout target reached" : `${payoutPercent}% to payout target`}</small>
            </div>
          ) : null}
        </div>
        <div className="payout-pack-label">
          <small>{activeWithdrawal ? "Current payment" : "Payout target"}</small>
          <strong>{payoutPackLabel}</strong>
        </div>
      </section>

      <WithdrawalPassPanel snapshot={ecosystem} />

      <section className="withdrawal-panel pc-luxe-vault-action">
        <div>
          <span className="app-eyebrow">{presentation.eyebrow}</span>
          <h2>{presentation.title}</h2>
          <p>{presentation.detail}</p>
        </div>

        {activeWithdrawal ? (
          activeWithdrawal.status === "held" ? (
            <div className="claim-message neutral">
              Reserved since {compactDate(activeWithdrawal.created_at)} · {maskDestination(activeWithdrawal.destination)}
            </div>
          ) : presentation.submitEnabled ? (
            <form action="/api/withdrawals" method="post" className="withdrawal-form">
              <label>
                Payment destination
                <input type="text" value={maskDestination(activeWithdrawal.destination)} disabled readOnly />
              </label>
              <TurnstileField action="withdrawal-retry" />
              <button className="button button-light button-lg" type="submit">{presentation.buttonLabel}</button>
              <small>This continues the same payout request.</small>
            </form>
          ) : (
            <div className="claim-message neutral">
              {maskDestination(activeWithdrawal.destination)} · No new action is required right now.
            </div>
          )
        ) : presentation.destinationEnabled && canWithdraw ? (
          <form action="/api/withdrawals" method="post" className="withdrawal-form">
            <label>
              FaucetPay destination
              <input name="destination" type="text" required maxLength={200} autoComplete="off" placeholder="Email, username or linked address" />
            </label>
            <TurnstileField action="withdrawal" />
            <button className="button button-light button-lg" type="submit">{payout.display ? `Withdraw ${payout.display}` : presentation.buttonLabel}</button>
            <small>We verify the destination before the payout is reserved.</small>
          </form>
        ) : (
          <button className="button button-light button-lg" type="button" disabled>{presentation.buttonLabel}</button>
        )}
      </section>

      <div className="wallet-grid pc-luxe-vault-grid">
        <section className="transaction-card">
          <div className="app-section-head">
            <div><span className="app-eyebrow">History</span><h2>What moved your balance.</h2></div>
          </div>
          {rows.length ? rows.map((row) => {
            const positive = row.credits > 0;
            return (
              <div className="transaction-row" key={row.id}>
                <span className={`transaction-status ${positive ? "positive" : "neutral"}`}><Check /></span>
                <div><strong>{row.label}</strong><small>{compactDate(row.createdAt)} · {row.state}</small></div>
                <b className={positive ? "positive" : "neutral"}>{formatUsdFromCredits(row.credits, true)}</b>
              </div>
            );
          }) : (
            <div className="empty-ledger">{state.preview ? "Live activity appears after connection." : "Your first reward starts the history here."}</div>
          )}
        </section>

        <aside className="trust-card pc-luxe-vault-trust">
          <Shield />
          <span className="app-eyebrow">How payouts work</span>
          <h3>Available → Reserved → Paid.</h3>
          <p>Once a payout starts, that amount stays reserved until the request completes or returns to your Vault.</p>
          <div className="state-list">
            <span className="done">Available</span>
            <span className={activeWithdrawal ? "active" : ""}>Reserved</span>
            <span>Paid</span>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
