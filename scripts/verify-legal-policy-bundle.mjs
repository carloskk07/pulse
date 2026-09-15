import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../legal-policy-manifest.json", import.meta.url), "utf8"));
const failures = [];

for (const file of manifest.files ?? []) {
  const actual = execFileSync("git", ["hash-object", file.path], { encoding: "utf8" }).trim();
  if (actual !== file.gitBlobSha) {
    failures.push(`${file.path}: expected ${file.gitBlobSha}, got ${actual}`);
  }
}

if (!manifest.schema || !manifest.revision || !Array.isArray(manifest.files) || manifest.files.length === 0) {
  failures.push("legal-policy-manifest.json is incomplete");
}

if (failures.length > 0) {
  console.error("Legal policy bundle verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("Update the policy review revision and manifest hashes whenever governed legal content changes.");
  process.exit(1);
}

console.log(`Legal policy bundle PASS: ${manifest.revision} (${manifest.files.length} governed files)`);
