import { readFileSync } from "node:fs";

export function verifyHomePrerenderManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Invalid Next prerender manifest.");
  }

  const home = manifest.routes?.["/"];
  if (!home || typeof home !== "object") {
    throw new Error("Home is not present in the Next prerender manifest.");
  }

  const revalidate = home.initialRevalidateSeconds;
  if (revalidate !== false && (!Number.isFinite(revalidate) || revalidate <= 0)) {
    throw new Error(`Home has invalid prerender revalidation: ${revalidate}`);
  }

  return true;
}

function expectFailure(name, fn) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(`Self-test expected failure: ${name}`);
}

if (process.argv.includes("--self-test")) {
  verifyHomePrerenderManifest({ routes: { "/": { initialRevalidateSeconds: 30 } } });
  verifyHomePrerenderManifest({ routes: { "/": { initialRevalidateSeconds: false } } });
  expectFailure("missing Home", () => verifyHomePrerenderManifest({ routes: {} }));
  expectFailure("invalid revalidate", () => verifyHomePrerenderManifest({ routes: { "/": { initialRevalidateSeconds: 0 } } }));
  console.log("Home prerender verifier self-test PASS");
} else {
  const manifestPath = process.argv[2] ?? ".next/prerender-manifest.json";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  verifyHomePrerenderManifest(manifest);
  console.log(`Home prerender contract PASS: ${manifestPath}`);
}
