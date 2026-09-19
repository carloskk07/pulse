// rerun after v52 immutable release authority
import https from "node:https";
import { performance } from "node:perf_hooks";
import { appendFileSync, writeFileSync } from "node:fs";

const BASE = process.env.LOAD_BASE_URL ?? "https://pulsercuit.pro";
const parsedBase = new URL(BASE);
if (parsedBase.protocol !== "https:" || parsedBase.hostname !== "pulsercuit.pro") {
  throw new Error(`Refusing load probe against unexpected target: ${BASE}`);
}

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 1200,
  maxFreeSockets: 256,
  timeout: 15_000,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, pct) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

function oneRequest(pathname, timeoutMs = 15_000) {
  return new Promise((resolve) => {
    const started = performance.now();
    const url = new URL(pathname, BASE);

    const req = https.request(
      url,
      {
        method: "GET",
        agent,
        headers: {
          accept: "application/json,text/html;q=0.9,*/*;q=0.8",
          "user-agent": "pulsercuit-production-capacity-probe/1.0",
          "x-pulsercuit-load-probe": "true",
        },
      },
      (res) => {
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
        });
        res.on("end", () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 400,
            status: res.statusCode ?? 0,
            ms: performance.now() - started,
            bytes,
          });
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("request_timeout"));
    });

    req.on("error", (error) => {
      resolve({
        ok: false,
        status: 0,
        ms: performance.now() - started,
        bytes: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    req.end();
  });
}

async function runStage(target, concurrency) {
  const started = performance.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, () => oneRequest(target.path, target.timeoutMs)),
  );
  const durationMs = performance.now() - started;
  const latencies = results.map((r) => r.ms);
  const successes = results.filter((r) => r.ok).length;
  const failures = concurrency - successes;
  const statusCounts = {};
  const errorCounts = {};

  for (const result of results) {
    const key = String(result.status);
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
    if (result.error) {
      errorCounts[result.error] = (errorCounts[result.error] ?? 0) + 1;
    }
  }

  const summary = {
    target: target.name,
    path: target.path,
    concurrency,
    successes,
    failures,
    errorRate: failures / concurrency,
    durationMs: Number(durationMs.toFixed(1)),
    throughputRps: Number((successes / (durationMs / 1000)).toFixed(1)),
    p50Ms: Number(percentile(latencies, 50)?.toFixed(1) ?? 0),
    p95Ms: Number(percentile(latencies, 95)?.toFixed(1) ?? 0),
    p99Ms: Number(percentile(latencies, 99)?.toFixed(1) ?? 0),
    maxMs: Number(Math.max(...latencies).toFixed(1)),
    statusCounts,
    errorCounts,
  };

  console.log(JSON.stringify({ type: "stage", ...summary }));
  return summary;
}

const targets = [
  {
    name: "cdn-home",
    path: "/",
    stages: [100, 250, 500, 1000],
    maxErrorRate: 0.01,
    maxP95Ms: 3000,
    timeoutMs: 15_000,
  },
  {
    name: "health-function",
    path: "/api/health",
    stages: [100, 250, 500, 1000],
    maxErrorRate: 0.01,
    maxP95Ms: 3000,
    timeoutMs: 15_000,
  },
  {
    name: "schema-db-light",
    path: "/api/release-schema",
    stages: [100, 250, 500, 1000],
    maxErrorRate: 0.01,
    maxP95Ms: 3500,
    timeoutMs: 15_000,
  },
  {
    name: "readiness-db-heavy",
    path: "/api/readiness",
    stages: [25, 50, 100, 200],
    maxErrorRate: 0.01,
    maxP95Ms: 5000,
    timeoutMs: 20_000,
  },
];

const report = {
  service: "pulsercuit",
  target: BASE,
  generatedAt: new Date().toISOString(),
  methodology: "single-request concurrent bursts with automatic stop thresholds",
  targets: [],
};

for (const target of targets) {
  const targetReport = {
    name: target.name,
    path: target.path,
    thresholds: {
      maxErrorRate: target.maxErrorRate,
      maxP95Ms: target.maxP95Ms,
    },
    stages: [],
    stoppedEarly: false,
    stopReason: null,
  };

  for (const concurrency of target.stages) {
    const stage = await runStage(target, concurrency);
    targetReport.stages.push(stage);

    if (stage.errorRate > target.maxErrorRate) {
      targetReport.stoppedEarly = true;
      targetReport.stopReason = `error_rate_${(stage.errorRate * 100).toFixed(2)}pct`;
      console.log(JSON.stringify({
        type: "circuit_breaker",
        target: target.name,
        reason: targetReport.stopReason,
      }));
      break;
    }

    if (stage.p95Ms > target.maxP95Ms) {
      targetReport.stoppedEarly = true;
      targetReport.stopReason = `p95_${stage.p95Ms}ms`;
      console.log(JSON.stringify({
        type: "circuit_breaker",
        target: target.name,
        reason: targetReport.stopReason,
      }));
      break;
    }

    await sleep(3000);
  }

  report.targets.push(targetReport);
  await sleep(5000);
}

const postHealth = await runStage({
  name: "post-health",
  path: "/api/health",
  timeoutMs: 15_000,
}, 10);

report.postHealth = postHealth;
writeFileSync("production-load-probe.json", JSON.stringify(report, null, 2) + "\n", "utf8");

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const lines = [
    "## Pulsercuit production capacity probe",
    "",
    "| Target | Concurrency | Success | Errors | p50 | p95 | p99 | Throughput |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const target of report.targets) {
    for (const stage of target.stages) {
      lines.push(
        `| ${target.name} | ${stage.concurrency} | ${stage.successes} | ${stage.failures} | ${stage.p50Ms} ms | ${stage.p95Ms} ms | ${stage.p99Ms} ms | ${stage.throughputRps} req/s |`,
      );
    }
  }

  lines.push(
    "",
    "### Safety",
    "",
    "- No claim, payout, funding or mutation endpoint is called.",
    "- Each stage is a single-request burst, not a sustained flood.",
    "- Automatic circuit breakers stop escalation on >1% errors or excessive p95 latency.",
    `- Post-test health: ${postHealth.successes}/${postHealth.concurrency} successful.`,
    "",
  );
  appendFileSync(summaryPath, lines.join("\n") + "\n", "utf8");
}

if (postHealth.failures > 0) {
  throw new Error("Post-load health probe failed.");
}
