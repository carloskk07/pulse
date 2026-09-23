import { getPulseEcosystemSnapshot, type PulseEcosystemSnapshot } from "@/lib/pulse-ecosystem";
import { formatUsdFromCredits } from "@/lib/reward-state";

function compact(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function WithdrawalPassPanel({ snapshot }: { snapshot?: PulseEcosystemSnapshot }) {
  const ecosystem = snapshot ?? await getPulseEcosystemSnapshot();
  const nextFree = compact(ecosystem.nextFreeWithdrawalAt);

  return (
    <section className="pc-v13-withdraw-pass">
      <div>
        <span className="app-eyebrow">Withdrawal access</span>
        <h2>{ecosystem.freeWithdrawalAvailable ? "Your free withdrawal is available." : "Your next free withdrawal is already scheduled."}</h2>
        <p>{ecosystem.freeWithdrawalAvailable
          ? ecosystem.extraWithdrawalsEnabled
            ? `One payout is fee-free every 24 hours. Additional withdrawals in the same window are available for a ${formatUsdFromCredits(ecosystem.extraWithdrawalFeeCredits)} fee.`
            : "One provider payout can be fee-free inside each 24-hour cycle."
          : ecosystem.extraWithdrawalsEnabled
            ? nextFree
              ? `The next fee-free window opens ${nextFree}. Need another payout before then? The extra-withdrawal fee is ${formatUsdFromCredits(ecosystem.extraWithdrawalFeeCredits)}.`
              : `The fee-free window refreshes automatically. Extra withdrawals cost ${formatUsdFromCredits(ecosystem.extraWithdrawalFeeCredits)}.`
            : nextFree
              ? "The next fee-free window opens " + nextFree + "."
              : "The fee-free window refreshes automatically."}</p>
      </div>

      <div className="pc-v13-withdraw-pass-metrics">
        <span><small>Free withdrawal</small><strong>{ecosystem.freeWithdrawalAvailable ? "READY" : "USED"}</strong></span>
        <span><small>Extra withdrawal</small><strong>{ecosystem.extraWithdrawalsEnabled ? formatUsdFromCredits(ecosystem.extraWithdrawalFeeCredits) + " fee" : "Locked"}</strong></span>
      </div>
    </section>
  );
}
