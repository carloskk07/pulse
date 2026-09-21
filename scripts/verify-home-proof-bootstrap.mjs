import { readFileSync } from "node:fs";

const ATTRIBUTES = {
  source: "data-proof-source",
  available: "data-proof-available",
  memberCount: "data-proof-member-count",
  rewardEventCount: "data-proof-reward-event-count",
  paidWithdrawalCount: "data-proof-paid-withdrawal-count",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
}

function attribute(html, name) {
  const match = html.match(new RegExp(`${escapeRegExp(name)}="([^"]*)"`));
  return match?.[1] ?? null;
}

function safeCount(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return number;
}

export function verifyHomeProofBootstrap(html, proof) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof) || proof.available !== true) {
    throw new Error("Authoritative public social proof is not available.");
  }

  if (attribute(html, ATTRIBUTES.source) !== "server-bootstrap") {
    throw new Error("Home is missing server-bootstrap proof provenance.");
  }
  if (attribute(html, ATTRIBUTES.available) !== "true") {
    throw new Error("Home did not render available proof in the initial HTML.");
  }

  const checks = [
    ["memberCount", "member count"],
    ["rewardEventCount", "reward event count"],
    ["paidWithdrawalCount", "paid withdrawal count"],
  ];

  for (const [key, label] of checks) {
    const proofCount = safeCount(proof[key], `authoritative ${label}`);
    const renderedRaw = attribute(html, ATTRIBUTES[key]);
    if (renderedRaw === null) {
      throw new Error(`Home is missing rendered ${label} evidence.`);
    }
    const renderedCount = safeCount(renderedRaw, `rendered ${label}`);

    if (renderedCount > proofCount) {
      throw new Error(`Home overstates ${label}: rendered=${renderedCount} authoritative=${proofCount}`);
    }
    if (proofCount > 0 && renderedCount === 0) {
      throw new Error(`Home collapsed a positive ${label} to zero.`);
    }
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
  const goodHtml = '<div data-proof-source="server-bootstrap" data-proof-available="true" data-proof-member-count="4" data-proof-reward-event-count="13" data-proof-paid-withdrawal-count="1"></div>';
  const proof = { available: true, memberCount: 4, rewardEventCount: 13, paidWithdrawalCount: 1 };

  verifyHomeProofBootstrap(goodHtml, proof);
  verifyHomeProofBootstrap(
    '<div data-proof-source="server-bootstrap" data-proof-available="true" data-proof-member-count="3" data-proof-reward-event-count="12" data-proof-paid-withdrawal-count="1"></div>',
    proof,
  );

  expectFailure("missing provenance", () => verifyHomeProofBootstrap(
    '<div data-proof-available="true" data-proof-member-count="4" data-proof-reward-event-count="13" data-proof-paid-withdrawal-count="1"></div>',
    proof,
  ));
  expectFailure("zeroed positive proof", () => verifyHomeProofBootstrap(
    '<div data-proof-source="server-bootstrap" data-proof-available="true" data-proof-member-count="0" data-proof-reward-event-count="13" data-proof-paid-withdrawal-count="1"></div>',
    proof,
  ));
  expectFailure("overstated proof", () => verifyHomeProofBootstrap(
    '<div data-proof-source="server-bootstrap" data-proof-available="true" data-proof-member-count="5" data-proof-reward-event-count="13" data-proof-paid-withdrawal-count="1"></div>',
    proof,
  ));
  expectFailure("unavailable authority", () => verifyHomeProofBootstrap(goodHtml, { ...proof, available: false }));

  console.log("Home proof bootstrap verifier self-test PASS");
} else {
  const [htmlPath, proofPath] = process.argv.slice(2);
  if (!htmlPath || !proofPath) {
    throw new Error("Usage: node scripts/verify-home-proof-bootstrap.mjs <home-html> <proof-json>");
  }

  const html = readFileSync(htmlPath, "utf8");
  const proof = JSON.parse(readFileSync(proofPath, "utf8"));
  verifyHomeProofBootstrap(html, proof);
  console.log("Home proof bootstrap PASS");
}
