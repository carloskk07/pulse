import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClaimRevealHero, type ClaimRevealTone } from "@/components/claim-reveal-hero";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visual fixture" };

type Props = { searchParams: Promise<{ tone?: string }> };

const fixtures: Record<ClaimRevealTone, {
  availableBalance: string;
  boostedReward: boolean;
  payoutRemaining: string;
  probabilityLabel: string;
  revealLabel: string;
  revealLead: string;
  rewardValue: string;
  signalStage: string;
  topReward: boolean;
}> = {
  standard: {
    availableBalance: "$0.018",
    boostedReward: false,
    payoutRemaining: "$0.032",
    probabilityLabel: "70% launch chance",
    revealLabel: "Reward revealed",
    revealLead: "This claim was resolved from the live variable reward range and is already reflected in your balance.",
    rewardValue: "$0.001",
    signalStage: "Spark",
    topReward: false,
  },
  boosted: {
    availableBalance: "$0.022",
    boostedReward: true,
    payoutRemaining: "$0.028",
    probabilityLabel: "2% launch chance",
    revealLabel: "Higher reward hit",
    revealLead: "This claim landed above the minimum reward band and is already reflected in your balance.",
    rewardValue: "$0.005",
    signalStage: "Flow",
    topReward: false,
  },
  top: {
    availableBalance: "$0.067",
    boostedReward: false,
    payoutRemaining: "Ready",
    probabilityLabel: "0.1% launch chance",
    revealLabel: "Top reward hit",
    revealLead: "You hit the highest configured faucet reward in the current launch range.",
    rewardValue: "$0.05",
    signalStage: "Rhythm",
    topReward: true,
  },
};

export default async function ClaimRevealVisualFixture({ searchParams }: Props) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host")?.toLowerCase() ?? "";
  const localVisualHost = host.startsWith("127.0.0.1:") || host.startsWith("localhost:");
  if (!localVisualHost) notFound();

  const params = await searchParams;
  const tone = params.tone === "boosted" || params.tone === "top" ? params.tone : "standard";
  const fixture = fixtures[tone];

  return (
    <AppShell active="home" userLabel="Visual fixture">
      <main className="pc-claim-handoff pc-v8-claim-handoff">
        <ClaimRevealHero
          availableBalance={fixture.availableBalance}
          boostedReward={fixture.boostedReward}
          payoutRemaining={fixture.payoutRemaining}
          probabilityLabel={fixture.probabilityLabel}
          revealLabel={fixture.revealLabel}
          revealLead={fixture.revealLead}
          rewardTone={tone}
          rewardValue={fixture.rewardValue}
          signalStage={fixture.signalStage}
          topReward={fixture.topReward}
          variableReward
        />
      </main>
    </AppShell>
  );
}
