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
        <h2>{ecosystem.freeWithdrawalAvailable ? "Your fee-free withdrawal is available." : "Your next fee-free withdrawal is already scheduled."}</h2>
        <p>{ecosystem.freeWithdrawalAvailable
          ? ecosystem.extraWithdrawalsEnabled
            ? `One withdrawal every 24 hours has no service fee. Extra withdrawals stay available for ${formatUsdFromCredits(ecosystem.extraWithdrawalFeeCredits)} each.`
            : "One withdrawal every 24 hours has no service fee."
          : nextFree
            ? ecosystem.extraWithdrawalsEnabled
              ? `Your next fee-free withdrawal opens ${nextFree}. You can withdraw sooner for a ${formatUsdFromCredits(ecosystem.extraWithdrawalFeeCredits)} service fee.`
              : "The next fee-free window opens " + nextFree + "."
            : "The fee-free window refreshes automatically."}</p>
      </div>

      <div className="pc-v13-withdraw-pass-metrics">
        <span><small>Free withdrawal</small><strong>{ecosystem.freeWithdrawalAvailable ? "READY" : "USED"}</strong></span>
        <span><small>Extra withdrawal</small><strong>{ecosystem.extraWithdrawalsEnabled ? formatUsdFromCredits(ecosystem.extraWithdrawalFeeCredits) + " fee" : "Locked"}</strong></span>
      </div>
    </section>
  );
}
