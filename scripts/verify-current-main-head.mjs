import { readFileSync } from "node:fs";

export function verifyCurrentMainHead(expectedSha, payload) {
  if (!/^[0-9a-f]{40}$/i.test(String(expectedSha ?? ""))) {
    throw new Error(`Invalid expected main SHA: ${expectedSha}`);
  }
  const actualSha = payload && typeof payload === "object" && !Array.isArray(payload)
    ? String(payload.sha ?? "")
    : "";

  if (actualSha !== expectedSha) {
    throw new Error(`Production deploy rejected: ${expectedSha} is not the current main HEAD (current: ${actualSha || "unknown"}).`);
  }
  return actualSha;
}

function selfTest() {
  const sha = "a".repeat(40);
  if (verifyCurrentMainHead(sha, { sha }) !== sha) {
    throw new Error("Current-main-head self-test failed for matching SHA.");
  }

  for (const payload of [{ sha: "b".repeat(40) }, {}, null]) {
    let rejected = false;
    try {
      verifyCurrentMainHead(sha, payload);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error("Current-main-head self-test accepted a stale or missing main SHA.");
    }
  }

  console.log("Current main HEAD contract PASS");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const expectedSha = process.argv[2];
  const payloadPath = process.argv[3];
  if (!expectedSha || !payloadPath) {
    throw new Error("Usage: node scripts/verify-current-main-head.mjs <expected-sha> <main-commit-json>");
  }
  const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
  const actualSha = verifyCurrentMainHead(expectedSha, payload);
  console.log(`Current main HEAD PASS: ${actualSha}`);
}
