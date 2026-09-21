import { getPulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";

function compact(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function WithdrawalPassPanel() {
  const ecosystem = await getPulseEcosystemSnapshot();
  const nextFree = compact(ecosystem.nextFreeWithdrawalAt);

  return (
    <section className="pc-v13-withdraw-pass">
      <div>
        <span className="app-eyebrow">Withdrawal Pass</span>
        <h2>{ecosystem.freeWithdrawalAvailable ? "Your free withdrawal is available." : "Your next free withdrawal is already scheduled."}</h2>
        <p>{ecosystem.freeWithdrawalAvailable
          ? "One provider payout can be fee-free inside each 24-hour cycle once the expanded withdrawal policy is activated."
          : nextFree
            ? "The next fee-free window opens " + nextFree + "."
            : "The fee-free window refreshes automatically."}</p>
      </div>

      <div className="pc-v13-withdraw-pass-metrics">
        <span><small>Free pass</small><strong>{ecosystem.freeWithdrawalAvailable ? "READY" : "USED"}</strong></span>
        <span><small>Extra withdrawal</small><strong>{ecosystem.extraWithdrawalsEnabled ? ecosystem.extraWithdrawalFeeCredits + " P fee" : "Locked"}</strong></span>
      </div>
    </section>
  );
}
