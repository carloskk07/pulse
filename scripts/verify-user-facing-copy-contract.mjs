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
    "without being locked to one permanent prize",
    "Live reward range",
    "not a permanent prize amount.",
    "Claim. Earn more.",
    "Cash out.",
    "More reasons to earn. Fewer reasons to guess.",
    "Real records.",
    "No inflated counters.",
    "See every reward",
    "in real value.",
  ]],
  ["app/proof/page.tsx", ["Claims, rewards and payouts — shown separately.", "How these numbers work", "Ready to earn?", "Start with the free hourly faucet."]],
  ["app/faucet/page.tsx", ["not tied to one permanent prize amount", "Not one permanent prize", "A faucet should make the reward obvious.", "Current availability", "Create free account"]],
  ["app/progress/page.tsx", ["See what your activity has built.", "Five ranks. One clear path."]],
  ["app/invite/page.tsx", ["Invite friends. See the reward before you share."]],
  ["app/earn/page.tsx", ["More ways to earn between faucet claims."]],
  ["app/support/page.tsx", ["Tell us what happened. Keep one reference."]],
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
