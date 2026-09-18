import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function requireText(path, fragments) {
  const value = read(path);
  for (const fragment of fragments) {
    if (!value.includes(fragment)) {
      throw new Error(`${path} is missing route/layout contract: ${fragment}`);
    }
  }
}

const appShellRoutes = new Map([
  ["app/dashboard/page.tsx", "home"],
  ["app/dashboard/claimed/page.tsx", "home"],
  ["app/progress/page.tsx", "progress"],
  ["app/earn/page.tsx", "earn"],
  ["app/wallet/page.tsx", "wallet"],
  ["app/invite/page.tsx", "invite"],
  ["app/account/page.tsx", "account"],
  ["app/admin/page.tsx", "admin"],
  ["app/admin/product/page.tsx", "product"],
  ["app/admin/faucetpay/page.tsx", "faucetpay-admin"],
  ["app/admin/support/page.tsx", "support-admin"],
  ["app/admin/leads/page.tsx", "leads"],
  ["app/admin/prospects/page.tsx", "prospects"],
  ["app/admin/retention/page.tsx", "retention"],
]);

for (const [path, active] of appShellRoutes) {
  const value = read(path);
  if (!value.includes('import { AppShell } from "@/components/app-shell";')) {
    throw new Error(`${path} must import the canonical AppShell.`);
  }
  const marker = `<AppShell active="${active}">`;
  if (!value.includes(marker)) {
    throw new Error(`${path} must render the canonical shell with ${marker}.`);
  }
  const shellCount = (value.match(/<AppShell\b/g) ?? []).length;
  if (shellCount !== 1) {
    throw new Error(`${path} must render exactly one AppShell; found ${shellCount}.`);
  }
}

const publicRouteContracts = new Map([
  ["app/page.tsx", ['className="pc-v6"', "<SiteHeader overlay />"]],
  ["app/proof/page.tsx", ['className="proof-page"', 'className="proof-hero shell"', "<SiteHeader />"]],
  ["app/business/page.tsx", ['className="marketing-page business-page"', 'className="business-hero shell"', "<SiteHeader />"]],
  ["app/business/integration/page.tsx", ['className="marketing-page integration-page"', 'className="integration-hero shell"', "<SiteHeader />"]],
  ["app/auth/page.tsx", ['className="auth-page pc-v5-auth-page pc-luxe-auth-page"', 'className="auth-header shell"', 'className="auth-shell shell pc-v5-auth-shell"']],
  ["app/auth/recover/page.tsx", ['className="auth-page"', 'className="auth-header shell"', 'className="auth-shell shell"']],
  ["app/auth/update-password/page.tsx", ['className="auth-page"', 'className="auth-header shell"', 'className="auth-shell shell"']],
  ["app/support/page.tsx", ['className="completion-page"', 'className="completion-header shell"', 'className="completion-hero shell"']],
  ["app/privacy/page.tsx", ['className="completion-page"', 'className="completion-header shell"', 'className="policy-body shell"']],
  ["app/terms/page.tsx", ['className="completion-page"', 'className="completion-header shell"', 'className="policy-body shell"']],
  ["app/rewards-policy/page.tsx", ['className="completion-page"', 'className="completion-header shell"', 'className="policy-body shell"']],
  ["app/r/[handle]/page.tsx", ['className="referral-landing"', 'className="referral-header shell"', 'className="referral-funnel shell"']],
]);

for (const [path, fragments] of publicRouteContracts) {
  requireText(path, fragments);
}

requireText("components/app-shell.tsx", [
  '{ id: "home", href: "/dashboard"',
  '{ id: "progress", href: "/progress"',
  '{ id: "earn", href: "/earn"',
  '{ id: "wallet", href: "/wallet"',
  '{ id: "invite", href: "/invite"',
  '{ id: "retention", href: "/admin/retention"',
  'className="app-frame"',
  'className="app-sidebar"',
  'className="app-content"',
  'className="bottom-nav"',
]);

requireText("components/site-header.tsx", [
  'export function SiteHeader({ overlay = false }',
  'overlay ? "is-overlay" : "is-flow"',
  'className="shell pc-v6-shell pc-v6-header-inner"',
]);

requireText("app/styles/layout-authority.css", [
  "--pc11-public-max:1200px",
  "--pc11-app-max:1320px",
  "--pc11-sidebar:232px",
  "body{min-width:320px}",
  ".shell,.pc-v6-shell{",
  ".app-frame{",
  "grid-template-columns:var(--pc11-sidebar) minmax(0,1fr)!important",
  ".app-content{",
  "max-width:var(--pc11-app-max)!important",
  "@media(max-width:1120px)",
  ".app-sidebar{display:none!important}",
  ".bottom-nav{",
  "@media(max-width:760px)",
  "@media(max-width:560px)",
]);

console.log("Route shell/layout contract PASS");
