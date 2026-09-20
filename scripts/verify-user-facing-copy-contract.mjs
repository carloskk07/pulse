import { readFileSync } from "node:fs";

const surfaces = [
  ["app/page.tsx", readFileSync("app/page.tsx", "utf8")],
  ["app/auth/page.tsx", readFileSync("app/auth/page.tsx", "utf8")],
  ["app/dashboard/page.tsx", readFileSync("app/dashboard/page.tsx", "utf8")],
  ["lib/experience-presentation.ts", readFileSync("lib/experience-presentation.ts", "utf8")],
  ["components/v6-live-proof.tsx", readFileSync("components/v6-live-proof.tsx", "utf8")],
];

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
];

for (const [path, source] of surfaces) {
  for (const phrase of forbidden) {
    if (source.includes(phrase)) {
      throw new Error(`${path} exposes internal/defensive copy on a primary user surface: ${phrase}`);
    }
  }
}

const home = surfaces.find(([path]) => path === "app/page.tsx")?.[1] ?? "";
const required = [
  "A simpler reward loop",
  "Pulse → Vault → Payout",
  "Simple by",
  "Your balance.",
  "Share the",
  "One Pulse<br />at a<br />time",
];

for (const phrase of required) {
  if (!home.includes(phrase)) {
    throw new Error(`Home editorial contract missing: ${phrase}`);
  }
}

console.log("User-facing editorial quiet contract PASS");
