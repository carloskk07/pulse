import https from "node:https";
import { performance } from "node:perf_hooks";
import { appendFileSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.LOAD_BASE_URL ?? "https://pulsercuit.pro";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const runId = process.env.GITHUB_RUN_ID ?? "local";

const parsedBase = new URL(BASE);
if (parsedBase.protocol !== "https:" || parsedBase.hostname !== "pulsercuit.pro") {
  throw new Error(`Refusing authenticated load probe against unexpected target: ${BASE}`);
}
if (!url || !anonKey) {
  throw new Error("Authenticated load probe requires the public Supabase URL and publishable key.");
}

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 600,
  maxFreeSockets: 128,
  timeout: 20_000,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, pct) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()]
    .map(([name, item]) => `${name}=${item.value}`)
    .join("; ");
}

function oneDashboardRequest(cookie, requestNumber, captureBody = false) {
  return new Promise((resolve) => {
    const started = performance.now();
    const target = new URL("/dashboard", BASE);
    target.searchParams.set("capacity-probe", runId);
    target.searchParams.set("request", String(requestNumber));

    const req = https.request(
      target,
      {
        method: "GET",
        agent,
        headers: {
          accept: "text/html,application/xhtml+xml",
          cookie,
          "cache-control": "no-cache",
          "user-agent": "pulsercuit-authenticated-capacity-probe/1.0",
          "x-pulsercuit-load-probe": "authenticated-dashboard",
        },
      },
      (res) => {
        let bytes = 0;
        let body = "";
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (captureBody && body.length < 512_000) body += chunk.toString("utf8");
        });
        res.on("end", () => {
          resolve({
            ok: res.statusCode === 200,
            status: res.statusCode ?? 0,
            ms: performance.now() - started,
            bytes,
            location: res.headers.location ?? null,
            body: captureBody ? body : undefined,
          });
        });
      },
    );

    req.setTimeout(20_000, () => req.destroy(new Error("request_timeout")));
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

async function runStage(cookie, concurrency, serialOffset) {
  const started = performance.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, index) =>
      oneDashboardRequest(cookie, serialOffset + index, false),
    ),
  );
  const durationMs = performance.now() - started;
  const latencies = results.map((result) => result.ms);
  const successes = results.filter((result) => result.ok).length;
  const failures = concurrency - successes;
  const statusCounts = {};
  const errorCounts = {};

  for (const result of results) {
    const status = String(result.status);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (result.error) errorCounts[result.error] = (errorCounts[result.error] ?? 0) + 1;
  }

  const summary = {
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

  console.log(JSON.stringify({ type: "authenticated_dashboard_stage", ...summary }));
  return summary;
}

let syntheticUserId = null;
let authenticatedClient = null;
let cleanupError = null;

const report = {
  service: "pulsercuit",
  target: BASE,
  generatedAt: new Date().toISOString(),
  methodology: "ephemeral confirmed Supabase user, real SSR auth cookies, GET-only dashboard bursts",
  stages: [],
  stoppedEarly: false,
  stopReason: null,
};

try {
  const cookieJar = new Map();
  authenticatedClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return [...cookieJar.entries()].map(([name, item]) => ({
          name,
          value: item.value,
        }));
      },
      setAll(cookiesToSet) {
        for (const item of cookiesToSet) {
          cookieJar.set(item.name, {
            value: item.value,
            options: item.options,
          });
        }
      },
    },
  });

  const { data: signedIn, error: signInError } = await authenticatedClient.auth.signInAnonymously({
    options: {
      data: { purpose: "production_capacity_probe" },
    },
  });
  if (signInError || !signedIn.user || !signedIn.session) {
    throw new Error(`Synthetic anonymous sign-in failed: ${signInError?.message ?? "missing session"}`);
  }
  syntheticUserId = signedIn.user.id;
  report.syntheticUserId = syntheticUserId;

  const { data: profile, error: profileError } = await authenticatedClient
    .from("profiles")
    .select("id")
    .eq("id", syntheticUserId)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error(`Synthetic profile trigger/RLS proof failed: ${profileError?.message ?? "missing profile"}`);
  }

  const cookie = cookieHeader(cookieJar);
  if (!cookie || !cookie.includes("auth-token")) {
    throw new Error("SSR auth cookie was not produced.");
  }

  const warmup = await oneDashboardRequest(cookie, 0, true);
  const authenticatedMarkup = typeof warmup.body === "string"
    && warmup.body.includes("Know the")
    && warmup.body.includes("next move");
  if (!warmup.ok || warmup.location || !authenticatedMarkup) {
    throw new Error(
      `Authenticated dashboard proof failed: status=${warmup.status} location=${warmup.location ?? "none"} marker=${authenticatedMarkup}`,
    );
  }
  console.log(JSON.stringify({
    type: "authenticated_dashboard_proof",
    status: warmup.status,
    bytes: warmup.bytes,
    ms: Number(warmup.ms.toFixed(1)),
    authenticatedMarkup: true,
  }));

  const stages = [25, 50, 100, 200, 500];
  let serialOffset = 1;
  for (const concurrency of stages) {
    const stage = await runStage(cookie, concurrency, serialOffset);
    serialOffset += concurrency;
    report.stages.push(stage);

    if (stage.errorRate > 0.01) {
      report.stoppedEarly = true;
      report.stopReason = `error_rate_${(stage.errorRate * 100).toFixed(2)}pct`;
      console.log(JSON.stringify({
        type: "authenticated_dashboard_circuit_breaker",
        reason: report.stopReason,
      }));
      break;
    }
    if (stage.p95Ms > 5000) {
      report.stoppedEarly = true;
      report.stopReason = `p95_${stage.p95Ms}ms`;
      console.log(JSON.stringify({
        type: "authenticated_dashboard_circuit_breaker",
        reason: report.stopReason,
      }));
      break;
    }
    await sleep(3000);
  }

  const [
    { count: claims, error: claimsError },
    { count: ledger, error: ledgerError },
  ] = await Promise.all([
    authenticatedClient
      .from("pulse_claims")
      .select("*", { count: "exact", head: true })
      .eq("user_id", syntheticUserId),
    authenticatedClient
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", syntheticUserId),
  ]);
  if (claimsError) throw new Error(`Synthetic claim audit failed: ${claimsError.message}`);
  if (ledgerError) throw new Error(`Synthetic ledger audit failed: ${ledgerError.message}`);

  report.syntheticFinancialFootprint = {
    claims: claims ?? 0,
    ledger: ledger ?? 0,
  };
  if ((claims ?? 0) !== 0 || (ledger ?? 0) !== 0) {
    throw new Error(
      `Authenticated GET probe mutated financial state: ${JSON.stringify(report.syntheticFinancialFootprint)}`,
    );
  }

  const postHealth = await fetch(new URL("/api/health", BASE), {
    headers: {
      "cache-control": "no-cache",
      "user-agent": "pulsercuit-authenticated-capacity-probe/1.0",
    },
  });
  report.postHealth = {
    status: postHealth.status,
    ok: postHealth.ok,
  };
  if (!postHealth.ok) throw new Error(`Post-authenticated-load health failed: HTTP ${postHealth.status}`);

} finally {
  if (authenticatedClient) {
    try {
      await authenticatedClient.auth.signOut();
    } catch (error) {
      cleanupError = `signout: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  report.cleanup = {
    signedOut: Boolean(syntheticUserId) && !cleanupError,
    databaseDeletionRequired: Boolean(syntheticUserId),
    error: cleanupError,
  };

  writeFileSync(
    "authenticated-dashboard-capacity-probe.json",
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );

}

if (cleanupError) {
  throw new Error(`Authenticated capacity probe cleanup failed: ${cleanupError}`);
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const lines = [
    "## Authenticated dashboard capacity probe",
    "",
    "| Concurrent dashboard GETs | Success | Errors | p50 | p95 | p99 | Throughput |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.stages.map((stage) =>
      `| ${stage.concurrency} | ${stage.successes} | ${stage.failures} | ${stage.p50Ms} ms | ${stage.p95Ms} ms | ${stage.p99Ms} ms | ${stage.throughputRps} req/s |`,
    ),
    "",
    "### Safety",
    "",
    "- Ephemeral anonymous Supabase user; signed out by the runner and deleted from auth.users immediately after the run.",
    "- Real @supabase/ssr cookie path and protected /dashboard route.",
    "- GET requests only; no claim, payout, funding or mutation endpoint called.",
    `- Synthetic financial footprint: ${JSON.stringify(report.syntheticFinancialFootprint ?? {})}.`,
    `- Runner sign-out: ${report.cleanup?.signedOut ? "PASS" : "FAIL"}; database deletion follows immediately after orchestration.`,
    "",
  ];
  appendFileSync(summaryPath, lines.join("\n") + "\n", "utf8");
}
