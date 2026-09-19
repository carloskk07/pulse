import { readFileSync } from "node:fs";

export function verifyControlledReadinessResponse(status, body) {
  if (status !== 200) {
    throw new Error(`Controlled technical readiness returned HTTP ${status}; expected 200.`);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Controlled technical readiness returned a non-object response.");
  }
  if (body.service !== "pulsercircuit" && body.service !== "pulsercuit") {
    throw new Error(`Unexpected readiness service identity: ${String(body.service)}`);
  }
  if (body.scope !== "controlled-technical") {
    throw new Error(`Unexpected readiness scope: ${String(body.scope)}`);
  }
  if (body.readiness !== "READY") {
    throw new Error(`Controlled technical readiness is ${String(body.readiness)}; expected READY.`);
  }
  if (body.ready !== true) {
    throw new Error("Controlled technical readiness ready flag must be true.");
  }

  return {
    service: body.service,
    scope: body.scope,
    readiness: body.readiness,
    ready: body.ready,
  };
}

function selfTest() {
  verifyControlledReadinessResponse(200, {
    service: "pulsercuit",
    scope: "controlled-technical",
    readiness: "READY",
    ready: true,
  });

  const failures = [
    [503, { service: "pulsercuit", scope: "controlled-technical", readiness: "SETUP_REQUIRED", ready: false }],
    [503, { service: "pulsercuit", scope: "controlled-technical", readiness: "READY_FOR_EXTERNAL_PROOF", ready: false }],
    [200, { service: "other", scope: "controlled-technical", readiness: "READY", ready: true }],
    [200, { service: "pulsercuit", scope: "public", readiness: "READY", ready: true }],
    [200, { service: "pulsercuit", scope: "controlled-technical", readiness: "SETUP_REQUIRED", ready: true }],
    [200, { service: "pulsercuit", scope: "controlled-technical", readiness: "READY", ready: false }],
  ];

  for (const [status, body] of failures) {
    let failedClosed = false;
    try {
      verifyControlledReadinessResponse(status, body);
    } catch {
      failedClosed = true;
    }
    if (!failedClosed) {
      throw new Error("Controlled readiness gate self-test accepted a non-ready response.");
    }
  }

  console.log("Controlled readiness gate self-test PASS");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const status = Number(process.argv[2] ?? 0);
  const bodyPath = process.argv[3];
  if (!bodyPath) {
    throw new Error("Usage: node scripts/verify-controlled-readiness-gate.mjs <http-status> <response-file>");
  }

  const body = JSON.parse(readFileSync(bodyPath, "utf8"));
  const result = verifyControlledReadinessResponse(status, body);
  console.log(
    `Controlled readiness gate PASS: HTTP ${status}, scope=${result.scope}, state=${result.readiness}, ready=${result.ready}`,
  );
}
