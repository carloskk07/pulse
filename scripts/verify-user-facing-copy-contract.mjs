import { readFileSync } from "node:fs";

const surfacePaths = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/opengraph-image.tsx",
  "app/auth/page.tsx",
  "app/dashboard/page.tsx",
  "app/proof/page.tsx",
  "app/faucet/page.tsx",
  "app/progress/page.tsx",
  "app/wallet/page.tsx",
  "app/invite/page.tsx",
  "app/earn/page.tsx",
  "app/support/page.tsx",
  "app/dashboard/claimed/page.tsx",
  "components/claim-reveal-hero.tsx",
  "components/withdrawal-pass-panel.tsx",
  "components/network-depth-panel.tsx",
  "components/product-preview.tsx",
  "lib/reward-state.ts",
  "lib/experience-presentation.ts",
  "components/v6-live-proof.tsx",
];

const surfaces = surfacePaths.map((path) => [path, readFileSync(path, "utf8")]);

const forbidden = [
  "Treasury authority",
  "authoritative only",
  "No invented earning state",
  "no invented activity",
  "Production counts",
  "live payout pack",
  "No financial state is simulated",
  "Level {state.trustLevel}/5",
  "external offer supply",
  "No demo activity",
  "manufacturing activity",
  "manufacturing social proof",
  "server-authoritative",
  "decorative progress",
  "inventing a score",
  "never invent balance or activity",
  "controlled launch account",
  "production site URL",
  "net ledger value",
  "External supply",
  "actually exists",
  "No duplicate payout was created",
  "protected payment path",
  "Security checks run before sensitive account actions.",
  "Withdraw when you're ready",
  "Withdraw when you&apos;re ready",
  "Public access preparing",
  "Treasury capacity",
  "fair-share",
  "Launch status",
  "Controlled launch",
  "Your next Pulse",
  "Pulse is temporarily unavailable",
  "Pulse backing is refreshing",
  "Your Pulse is already being processed",
  "This Pulse needs a review",
  "Pulse verification is temporarily unavailable",
  "Hourly Pulse is now the active reward loop",
  "The Pulse did not complete",
  "Hourly Pulse",
  "Turbo completed",
  "Open Vault",
  "Back to Pulse",
  "Turbo never blocks Pulse",
  "More Turbo options",
  "returns to your Vault",
  "Return. Pulse. Build your rhythm.",
];

for (const [path, source] of surfaces) {
  for (const phrase of forbidden) {
    if (source.includes(phrase)) {
      throw new Error(`${path} exposes internal/defensive copy on a user-facing surface: ${phrase}`);
    }
  }
}

const requiredBySurface = new Map([
  ["app/page.tsx", [
    "Earn crypto.",
    "Know what it is worth.",
    "each eligible claim can reveal a different value",
    "Live reward range",
    "The active reward rule is shown before every eligible claim.",
    "Claim. Earn more.",
    "Cash out.",
    "More reasons to earn. Fewer reasons to guess.",
    "Real records.",
    "No inflated counters.",
    "See every reward",
    "in real value.",
  ]],
  ["app/proof/page.tsx", ["Claims, rewards and payouts — shown separately.", "How these numbers work", "Ready to earn?", "Start with the free hourly faucet."]],
  ["app/faucet/page.tsx", ["Each eligible claim reveals one value", "Variable reward draw", "One claim. Different possible rewards.", "A faucet should make the reward obvious.", "Current availability", "Create free account"]],
  ["app/progress/page.tsx", ["See what your activity has built.", "Five ranks. One clear path."]],
  ["app/invite/page.tsx", ["Invite friends. See the reward before you share."]],
  ["app/earn/page.tsx", ["More ways to earn between faucet claims.", "Extra rewards never block the faucet.", "More reward options", "Cashback estimate", "publicRewardLabel"]],
  ["app/support/page.tsx", ["Tell us what happened. Keep one reference."]],
  ["app/dashboard/claimed/page.tsx", ["<ClaimRevealHero", "rewardTone={rewardTone}", "probabilityLabel={probabilityLabel}"]],
  ["components/claim-reveal-hero.tsx", ["You revealed.", "Variable draw settled", "This claim", "balance now"]],
  ["app/dashboard/page.tsx", ["The faucet is temporarily unavailable.", "Your reward is already being processed.", "verified claim", "<span>Claims</span>", "View balance"]],
  ["lib/reward-state.ts", ['pulse_reward: "Faucet reward"', 'offer: "Extra reward completed"']],
  ["app/wallet/page.tsx", ["no fee", "service fee", "24-hour cycle", "If the payout fails", "returns to your balance"]],
  ["components/withdrawal-pass-panel.tsx", ["One withdrawal every 24 hours has no service fee.", "Extra withdrawal"]],
  ["components/network-depth-panel.tsx", ["Three levels. Three reward rates.", "10% · 3% · 1%", "eligible verified partner activity"]],
  ["components/product-preview.tsx", ["<Spark /> Reward", "Claim. Return. Build your progress.", "<strong>Faucet</strong>", "<strong>Extras</strong>"]],
]);

for (const [path, phrases] of requiredBySurface) {
  const source = surfaces.find(([surfacePath]) => surfacePath === path)?.[1] ?? "";
  for (const phrase of phrases) {
    if (!source.includes(phrase)) {
      throw new Error(`${path} editorial contract missing: ${phrase}`);
    }
  }
}

const home = surfaces.find(([path]) => path === "app/page.tsx")?.[1] ?? "";
for (const phrase of ["<h3>Share</h3>", "pc-v6-section pc-v6-share"]) {
  if (home.includes(phrase)) {
    throw new Error(`Home reintroduced a secondary Share narrative: ${phrase}`);
  }
}

console.log("User-facing editorial quiet contract PASS");
