import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function collectSourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(target));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(target);
    }
  }
  return files;
}

const helperPath = path.join(root, "lib", "admin-authorization.ts");
const helper = await fs.readFile(helperPath, "utf8");

assert(helper.includes('import "server-only";'), "Admin authorization must remain server-only.");
assert(helper.includes("supabase.auth.getUser()"), "Admin authorization must validate a fresh Auth user.");
assert(helper.includes('.from("admin_users")'), "Admin authorization must use the database allowlist.");
assert(helper.includes("createSupabaseAdminClient"), "Admin allowlist lookup must use trusted server authority.");
assert(helper.includes("getAdminAllowlistStatus"), "Admin navigation and route authorization must share one database allowlist helper.");

const adminFiles = await collectSourceFiles(path.join(root, "app", "admin"));
const runtimeFiles = [
  ...await collectSourceFiles(path.join(root, "app")),
  ...await collectSourceFiles(path.join(root, "components")),
  ...await collectSourceFiles(path.join(root, "lib")),
  ...await collectSourceFiles(path.join(root, "providers")),
];

for (const file of runtimeFiles) {
  const source = await fs.readFile(file, "utf8");
  assert(!source.includes("ADMIN_EMAILS"), `Legacy ADMIN_EMAILS runtime authority returned in ${path.relative(root, file)}`);
  assert(!source.includes("adminEmails("), `Local email allowlist returned in ${path.relative(root, file)}`);
}

const envExample = await fs.readFile(path.join(root, ".env.example"), "utf8");
assert(!envExample.includes("ADMIN_EMAILS"), "Legacy ADMIN_EMAILS configuration contract returned.");

const operationalScripts = (await collectSourceFiles(path.join(root, "scripts")))
  .filter((file) => path.basename(file) !== "verify-admin-authorization-contract.mjs");
for (const file of operationalScripts) {
  const source = await fs.readFile(file, "utf8");
  assert(!source.includes("ADMIN_EMAILS"), `Legacy ADMIN_EMAILS operational dependency returned in ${path.relative(root, file)}`);
}

const adminClient = await fs.readFile(path.join(root, "lib", "supabase", "admin.ts"), "utf8");
const serverClient = await fs.readFile(path.join(root, "lib", "supabase", "server.ts"), "utf8");
assert(adminClient.includes('import "server-only";'), "Service-role Supabase client must remain server-only.");
assert(serverClient.includes('import "server-only";'), "SSR Supabase server client must remain server-only.");

console.log(`Admin authorization contract OK (${adminFiles.length} admin surfaces; ${runtimeFiles.length} runtime source files; ${operationalScripts.length} operational scripts checked).`);
