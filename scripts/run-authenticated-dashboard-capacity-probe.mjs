import https from "node:https";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { appendFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.LOAD_BASE_URL ?? "https://pulsercuit.pro";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runId = process.env.GITHUB_RUN_ID ?? "local";

const parsedBase = new URL(BASE);
if (parsedBase.protocol !== "https:" || parsedBase.hostname !== "pulsercuit.pro") {
  throw new Error(`Refusing authenticated load probe against unexpected target: ${BASE}`);
}
if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("Authenticated load probe requires Supabase URL, anon key and service-role key.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function countOwnRows(table, userId) {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to audit ${table}: ${error.message}`);
  return count ?? 0;
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
  const email = `capacity-probe+${runId}-${crypto.randomBytes(6).toString("hex")}@example.com`;
  const password = `Pc!${crypto.randomBytes(28).toString("base64url")}9a`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { purpose: "production_capacity_probe" },
  });
  if (createError || !created.user) {
    throw new Error(`Synthetic auth user creation failed: ${createError?.message ?? "missing user"}`);
  }
  syntheticUserId = created.user.id;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", syntheticUserId)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error(`Synthetic profile trigger failed: ${profileError?.message ?? "missing profile"}`);
  }

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

  const { data: signedIn, error: signInError } = await authenticatedClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || signedIn.user?.id !== syntheticUserId || !signedIn.session) {
    throw new Error(`Synthetic sign-in failed: ${signInError?.message ?? "session mismatch"}`);
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

  const [claims, ledger, withdrawals, reservations] = await Promise.all([
    countOwnRows("pulse_claims", syntheticUserId),
    countOwnRows("ledger_entries", syntheticUserId),
    countOwnRows("withdrawals", syntheticUserId),
    countOwnRows("treasury_reservations", syntheticUserId),
  ]);
  report.syntheticFinancialFootprint = { claims, ledger, withdrawals, reservations };

  if (claims !== 0 || ledger !== 0 || withdrawals !== 0 || reservations !== 0) {
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

  if (syntheticUserId) {
    try {
      const { error } = await admin.auth.admin.deleteUser(syntheticUserId);
      if (error) throw error;

      const { data: lingeringProfile, error: profileCheckError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", syntheticUserId)
        .maybeSingle();
      if (profileCheckError) throw profileCheckError;
      if (lingeringProfile) throw new Error("Synthetic profile still exists after auth-user deletion.");
    } catch (error) {
      const message = `cleanup: ${error instanceof Error ? error.message : String(error)}`;
      cleanupError = cleanupError ? `${cleanupError}; ${message}` : message;
    }
  }

  report.cleanup = {
    syntheticUserDeleted: Boolean(syntheticUserId) && !cleanupError,
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
    "- Ephemeral confirmed Supabase user; removed at the end of the run.",
    "- Real @supabase/ssr cookie path and protected /dashboard route.",
    "- GET requests only; no claim, payout, funding or mutation endpoint called.",
    `- Synthetic financial footprint: ${JSON.stringify(report.syntheticFinancialFootprint ?? {})}.`,
    `- Cleanup: ${report.cleanup?.syntheticUserDeleted ? "PASS" : "FAIL"}.`,
    "",
  ];
  appendFileSync(summaryPath, lines.join("\n") + "\n", "utf8");
}
