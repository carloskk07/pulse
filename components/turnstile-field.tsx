import Script from "next/script";

export function TurnstileField({ action }: { action: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile turnstile-field" data-sitekey={siteKey} data-action={action} data-theme="dark" data-appearance="interaction-only" />
    </>
  );
}
