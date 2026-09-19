import { readFileSync } from "node:fs";

export function hasMergedMainPrProvenance(sha, pulls) {
  if (!/^[0-9a-f]{40}$/i.test(String(sha ?? ""))) return false;
  if (!Array.isArray(pulls)) return false;

  return pulls.some((pull) => pull
    && typeof pull === "object"
    && pull.state === "closed"
    && Boolean(pull.merged_at)
    && pull.base?.ref === "main"
    && pull.merge_commit_sha === sha);
}

export function requireMergedMainPrProvenance(eventName, sha, pulls) {
  if (eventName !== "push" && eventName !== "workflow_dispatch") {
    throw new Error(`Unsupported production deploy event: ${eventName}`);
  }
  if (!hasMergedMainPrProvenance(sha, pulls)) {
    throw new Error(`Production deploy rejected: ${sha} is not proven as the merge commit of a closed PR into main.`);
  }
  return pulls.find((pull) => pull?.merge_commit_sha === sha && pull?.merged_at && pull?.base?.ref === "main");
}

function runSelfTest() {
  const sha = "a".repeat(40);
  const merged = [{
    state: "closed",
    merged_at: "2026-09-17T00:00:00Z",
    merge_commit_sha: sha,
    base: { ref: "main" },
  }];
  const wrongSha = [{ ...merged[0], merge_commit_sha: "b".repeat(40) }];
  const open = [{ ...merged[0], state: "open", merged_at: null }];
  const wrongBase = [{ ...merged[0], base: { ref: "develop" } }];

  const assertions = [
    [hasMergedMainPrProvenance(sha, merged), true, "merged main PR"],
    [hasMergedMainPrProvenance(sha, wrongSha), false, "different merge SHA"],
    [hasMergedMainPrProvenance(sha, open), false, "open PR"],
    [hasMergedMainPrProvenance(sha, wrongBase), false, "wrong base"],
    [hasMergedMainPrProvenance(sha, []), false, "direct push with no PR"],
    [hasMergedMainPrProvenance("invalid", merged), false, "invalid SHA"],
  ];

  for (const [actual, expected, label] of assertions) {
    if (actual !== expected) {
      throw new Error(`Deploy provenance self-test failed for ${label}: expected ${expected}, received ${actual}`);
    }
  }

  for (const eventName of ["push", "workflow_dispatch"]) {
    const matched = requireMergedMainPrProvenance(eventName, sha, merged);
    if (matched?.merge_commit_sha !== sha) {
      throw new Error(`Deploy provenance self-test failed for ${eventName} merged provenance.`);
    }

    let rejected = false;
    try {
      requireMergedMainPrProvenance(eventName, sha, []);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(`Deploy provenance self-test failed: ${eventName} accepted missing PR provenance.`);
    }
  }

  let unsupportedRejected = false;
  try {
    requireMergedMainPrProvenance("schedule", sha, merged);
  } catch {
    unsupportedRejected = true;
  }
  if (!unsupportedRejected) {
    throw new Error("Deploy provenance self-test failed: unsupported event was accepted.");
  }

  console.log("Deploy PR provenance contract PASS");
}

function verify(eventName, sha, proofPath) {
  const pulls = JSON.parse(readFileSync(proofPath, "utf8"));
  const matched = requireMergedMainPrProvenance(eventName, sha, pulls);
  console.log(`Deploy provenance PASS: event=${eventName}, PR #${matched?.number ?? "unknown"} merged into main at ${matched?.merged_at ?? "unknown"}.`);
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const [, , eventName, sha, proofPath] = process.argv;
  if (!eventName || !sha || !proofPath) {
    throw new Error("Usage: node scripts/verify-deploy-provenance.mjs <event-name> <sha> <pulls-json-file>");
  }
  verify(eventName, sha, proofPath);
}
