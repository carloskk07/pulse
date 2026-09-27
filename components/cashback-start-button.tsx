import { ArrowUpRight } from "@/components/icons";
import { getRouteNavigationHref } from "@/lib/route-semantics";

export function CashbackStartButton({
  opportunityId,
  compact = false,
  label = "Open cashback",
}: {
  opportunityId: string;
  compact?: boolean;
  label?: string;
}) {
  return (
    <form action={getRouteNavigationHref("cashback", "/api/cashback/start")} method="post" className={compact ? "cashback-start-form compact" : "cashback-start-form"}>
      <input type="hidden" name="opportunity" value={opportunityId} />
      <button className={compact ? "inline-action" : "button button-light direct-primary-action"} type="submit">
        {label} <ArrowUpRight />
      </button>
    </form>
  );
}
