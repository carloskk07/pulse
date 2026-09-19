import { spawnSync } from "node:child_process";

const MAX_ATTEMPTS = 5;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const args = ["audit", "--omit=dev", "--audit-level=high"];
const transient = /(?:429|502|503|504|ECONNRESET|ETIMEDOUT|EAI_AGAIN|audit endpoint returned an error|performing maintenance|service unavailable)/i;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const result = spawnSync(npm, args, {
    encoding: "utf8",
    env: process.env,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const status = typeof result.status === "number" ? result.status : 1;
  if (status === 0) process.exit(0);

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const retryableInfrastructureFailure = transient.test(output);

  if (!retryableInfrastructureFailure) {
    // A real vulnerability result (including high/critical findings) is not retried or masked.
    process.exit(status);
  }

  if (attempt === MAX_ATTEMPTS) {
    console.error(`Security audit infrastructure remained unavailable after ${MAX_ATTEMPTS} attempts.`);
    process.exit(1);
  }

  const delayMs = attempt * 5000;
  console.warn(`Security audit infrastructure unavailable; retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${MAX_ATTEMPTS}).`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

process.exit(1);
