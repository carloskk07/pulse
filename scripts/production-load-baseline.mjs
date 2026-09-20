import fs from "node:fs";

const BASE_URL = process.env.PULSECIRCUIT_LOAD_BASE_URL ?? "https://pulsercuit.pro";
const REQUEST_TIMEOUT_MS = Number(process.env.PULSECIRCUIT_LOAD_TIMEOUT_MS ?? 10000);
const RUN_ID = [
  process.env.GITHUB_RUN_ID ?? "local",
  process.env.GITHUB_RUN_ATTEMPT ?? "0",
  Date.now(),
].join("-");

const ALLOWED_PATHS = new Set([
  "/api/health",
  "/api/public/social-proof",
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const rank = Math.max(0, Math.min(ordered.length - 1, Math.ceil((p / 100) * ordered.length) - 1));
  return ordered[rank];
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    const key = value || "(none)";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function validateTarget(path) {
  const url = new URL(path, BASE_URL);
  if (url.protocol !== "https:") {
    throw new Error(`Load probe requires HTTPS: ${url.href}`);
  }
  if (!ALLOWED_PATHS.has(url.pathname)) {
    throw new Error(`Load probe path is not allowlisted: ${url.pathname}`);
  }
  return url;
}

function semanticOk(kind, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;

  if (kind === "health") {
    return payload.ok === true && payload.service === "pulsercuit";
  }

  if (kind === "social-proof") {
    return (
      payload.available === true
      && typeof payload.memberCount === "number"
      && typeof payload.rewardEventCount === "number"
      && typeof payload.paidWithdrawalCount === "number"
      && Array.isArray(payload.recentActivity)
    );
  }

  return false;
}

async function oneRequest(stage, sequence) {
  const target = validateTarget(stage.path);
  if (stage.cacheBust) {
    target.searchParams.set("__pc_load_probe", `${RUN_ID}-${stage.name}-${sequence}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Pulsercuit-Production-Load-Probe/1.0",
        ...(stage.cacheBust ? { "Cache-Control": "no-cache" } : {}),
      },
    });

    const durationMs = performance.now() - started;
    const text = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    return {
      ok: response.ok && semanticOk(stage.kind, payload),
      httpOk: response.ok,
      semanticOk: semanticOk(stage.kind, payload),
      status: response.status,
      durationMs,
      cache: response.headers.get("x-vercel-cache") ?? response.headers.get("cf-cache-status") ?? "",
      age: response.headers.get("age") ?? "",
      serverTiming: response.headers.get("server-timing") ?? "",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      httpOk: false,
      semanticOk: false,
      status: 0,
      durationMs: performance.now() - started,
      cache: "",
      age: "",
      serverTiming: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runStage(stage) {
  const results = new Array(stage.requests);
  let next = 0;

  async function worker() {
    while (true) {
      const current = next++;
      if (current >= stage.requests) return;
      results[current] = await oneRequest(stage, current);
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: Math.min(stage.concurrency, stage.requests) }, () => worker()));
  const wallMs = performance.now() - started;

  const durations = results.map((item) => item.durationMs);
  const statusCounts = countBy(results.map((item) => String(item.status)));
  const cacheCounts = countBy(results.map((item) => item.cache));
  const errors = results.filter((item) => item.error);
  const semanticFailures = results.filter((item) => item.httpOk && !item.semanticOk);
  const fiveXx = results.filter((item) => item.status >= 500 && item.status <= 599);
  const successes = results.filter((item) => item.ok);

  const summary = {
    name: stage.name,
    kind: stage.kind,
    path: stage.path,
    cacheBust: stage.cacheBust,
    requests: stage.requests,
    concurrency: stage.concurrency,
    wallMs: round(wallMs),
    throughputRps: round(stage.requests / (wallMs / 1000), 2),
    successRatePct: round((successes.length / stage.requests) * 100, 2),
    p50Ms: round(percentile(durations, 50)),
    p95Ms: round(percentile(durations, 95)),
    p99Ms: round(percentile(durations, 99)),
    maxMs: round(Math.max(...durations)),
    networkErrors: errors.length,
    semanticFailures: semanticFailures.length,
    fiveXx: fiveXx.length,
    statusCounts,
    cacheCounts,
    stopEscalation:
      errors.length > 0
      || semanticFailures.length > 0
      || fiveXx.length > 0
      || percentile(durations, 95) > 2000,
  };

  console.log(JSON.stringify(summary));
  return summary;
}

function markdown(results, stoppedAt) {
  const lines = [
    "# Pulsercuit production load baseline",
    "",
    `Target: \`${BASE_URL}\``,
    "",
    "| Stage | Requests | Concurrency | RPS | Success | p50 | p95 | p99 | 5xx | Semantic failures |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const item of results) {
    lines.push(
      `| ${item.name} | ${item.requests} | ${item.concurrency} | ${item.throughputRps} | ${item.successRatePct}% | ${item.p50Ms} ms | ${item.p95Ms} ms | ${item.p99Ms} ms | ${item.fiveXx} | ${item.semanticFailures} |`,
    );
  }

  lines.push("");
  lines.push(
    stoppedAt
      ? `Adaptive origin ramp stopped after **${stoppedAt}** to protect production.`
      : "Adaptive origin ramp completed through concurrency 40 without the stop condition.",
  );
  lines.push("");
  lines.push("Safety: GET-only; allowlisted health/social-proof paths; no auth, claim, payout, reservation, funding, or write endpoint is called.");

  return `${lines.join("\n")}\n`;
}

async function main() {
  validateTarget("/api/health");
  validateTarget("/api/public/social-proof");

  const results = [];

  results.push(await runStage({
    name: "health-baseline",
    kind: "health",
    path: "/api/health",
    requests: 40,
    concurrency: 10,
    cacheBust: false,
  }));

  await sleep(750);

  results.push(await runStage({
    name: "social-cached",
    kind: "social-proof",
    path: "/api/public/social-proof",
    requests: 40,
    concurrency: 10,
    cacheBust: false,
  }));

  const cachedStage = results.at(-1);
  const hardFailure =
    results[0].successRatePct < 100
    || cachedStage.successRatePct < 100;

  let stoppedAt = null;
  const ramp = [
    [1, 20],
    [5, 30],
    [10, 50],
    [20, 80],
    [40, 120],
  ];

  for (const [concurrency, requests] of ramp) {
    await sleep(1000);
    const stage = await runStage({
      name: `social-origin-c${concurrency}`,
      kind: "social-proof",
      path: "/api/public/social-proof",
      requests,
      concurrency,
      cacheBust: true,
    });
    results.push(stage);

    if (stage.stopEscalation) {
      stoppedAt = stage.name;
      break;
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    maxConfiguredConcurrency: 40,
    results,
    stoppedAt,
    hardFailure,
  };

  fs.writeFileSync("production-load-results.json", `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync("production-load-summary.md", markdown(results, stoppedAt));

  if (hardFailure) {
    throw new Error("Production baseline failed before the adaptive origin ramp.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
