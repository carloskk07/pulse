import { readFileSync } from "node:fs";

export function verifyDeploymentReadinessResponse(status, body) {
  if (status !== 200) {
    throw new Error(`Deployment technical readiness returned HTTP ${status}; expected 200.`);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Deployment technical readiness returned a non-object response.");
  }
  if (body.service !== "pulsercuit") {
    throw new Error(`Unexpected deployment readiness service identity: ${String(body.service)}`);
  }
  if (body.scope !== "deployment-technical") {
    throw new Error(`Unexpected deployment readiness scope: ${String(body.scope)}`);
  }
  if (body.readiness !== "READY") {
    throw new Error(`Deployment technical readiness is ${String(body.readiness)}; expected READY.`);
  }
  if (body.ready !== true) {
    throw new Error("Deployment technical readiness ready flag must be true.");
  }

  return {
    service: body.service,
    scope: body.scope,
    readiness: body.readiness,
    ready: body.ready,
  };
}

function selfTest() {
  verifyDeploymentReadinessResponse(200, {
    service: "pulsercuit",
    scope: "deployment-technical",
    readiness: "READY",
    ready: true,
  });

  const failures = [
    [503, { service: "pulsercuit", scope: "deployment-technical", readiness: "BLOCKED", ready: false }],
    [200, { service: "other", scope: "deployment-technical", readiness: "READY", ready: true }],
    [200, { service: "pulsercuit", scope: "controlled-technical", readiness: "READY", ready: true }],
    [200, { service: "pulsercuit", scope: "deployment-technical", readiness: "BLOCKED", ready: true }],
    [200, { service: "pulsercuit", scope: "deployment-technical", readiness: "READY", ready: false }],
  ];

  for (const [status, body] of failures) {
    let failedClosed = false;
    try {
      verifyDeploymentReadinessResponse(status, body);
    } catch {
      failedClosed = true;
    }
    if (!failedClosed) {
      throw new Error("Deployment readiness gate self-test accepted a non-ready response.");
    }
  }

  console.log("Deployment readiness gate self-test PASS");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const status = Number(process.argv[2] ?? 0);
  const bodyPath = process.argv[3];
  if (!bodyPath) {
    throw new Error("Usage: node scripts/verify-deployment-readiness-gate.mjs <http-status> <response-file>");
  }

  const body = JSON.parse(readFileSync(bodyPath, "utf8"));
  const result = verifyDeploymentReadinessResponse(status, body);
  console.log(
    `Deployment readiness gate PASS: HTTP ${status}, scope=${result.scope}, state=${result.readiness}, ready=${result.ready}`,
  );
}
