import legalPolicyManifest from "@/legal-policy-manifest.json";

export type LegalOperatorIdentity = {
  name: string;
  jurisdiction: string;
  address: string;
  legalContactEmail: string;
  privacyContactEmail: string;
  registrationId: string | null;
};

function value(name: string) {
  return process.env[name]?.trim() ?? "";
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getLegalOperatorIdentity(): LegalOperatorIdentity | null {
  const identity: LegalOperatorIdentity = {
    name: value("LEGAL_OPERATOR_NAME"),
    jurisdiction: value("LEGAL_OPERATOR_JURISDICTION"),
    address: value("LEGAL_OPERATOR_ADDRESS"),
    legalContactEmail: value("LEGAL_CONTACT_EMAIL"),
    privacyContactEmail: value("PRIVACY_CONTACT_EMAIL"),
    registrationId: value("LEGAL_OPERATOR_REGISTRATION_ID") || null,
  };

  if (
    !identity.name ||
    !identity.jurisdiction ||
    !identity.address ||
    !validEmail(identity.legalContactEmail) ||
    !validEmail(identity.privacyContactEmail)
  ) return null;

  return identity;
}

function hostname(raw: string) {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function getLegalPolicyBundleIdentity() {
  return [
    legalPolicyManifest.schema,
    legalPolicyManifest.revision,
    ...legalPolicyManifest.files.map((item) => `${item.path}:${item.gitBlobSha}`),
  ];
}

export function getInternationalTransferProviderSet() {
  const providers = new Set<string>();
  const supabaseHost = hostname(value("NEXT_PUBLIC_SUPABASE_URL"));
  const siteHost = hostname(value("NEXT_PUBLIC_SITE_URL"));

  if (supabaseHost) providers.add(`supabase:${supabaseHost}`);
  if (siteHost) providers.add(`site:${siteHost}`);
  providers.add("hosting:vercel");
  if (value("NEXT_PUBLIC_TURNSTILE_SITE_KEY")) providers.add("security:cloudflare-turnstile");
  if (value("FAUCETPAY_READ_KEY") || value("FAUCETPAY_SCOPED_KEY")) providers.add("payout:faucetpay");
  if (value("AYET_API_KEY") || value("AYET_ADSLOT_ID")) providers.add("rewards:ayet");

  return [...providers].sort();
}
