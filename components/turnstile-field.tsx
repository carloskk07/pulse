"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileStatus = "loading" | "waiting" | "verified" | "expired" | "error" | "blocked";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove?: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const statusCopy: Record<TurnstileStatus, string> = {
  loading: "Preparing human verification…",
  waiting: "Complete the verification before continuing.",
  verified: "Human verification ready.",
  expired: "Verification expired. Complete it again to continue.",
  error: "Verification needs another try.",
  blocked: "Verification was blocked or could not load. Allow challenges.cloudflare.com for this site, then reload.",
};

export function TurnstileField({ action }: { action: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef("");
  const pendingSubmitRef = useRef(false);
  const [status, setStatus] = useState<TurnstileStatus>("loading");
  const [token, setToken] = useState("");

  const renderWidget = useCallback(() => {
    const api = window.turnstile;
    const container = containerRef.current;
    if (!siteKey || !api || !container || widgetIdRef.current) return false;

    try {
      widgetIdRef.current = api.render(container, {
        sitekey: siteKey,
        action,
        theme: "dark",
        appearance: "always",
        "response-field": false,
        callback: (nextToken: string) => {
          tokenRef.current = nextToken;
          setToken(nextToken);
          setStatus("verified");

          if (pendingSubmitRef.current) {
            pendingSubmitRef.current = false;
            const form = containerRef.current?.closest("form") as HTMLFormElement | null;
            if (form) requestAnimationFrame(() => form.requestSubmit());
          }
        },
        "expired-callback": () => {
          tokenRef.current = "";
          setToken("");
          setStatus("expired");
        },
        "error-callback": () => {
          tokenRef.current = "";
          setToken("");
          setStatus("error");
        },
        "timeout-callback": () => {
          tokenRef.current = "";
          setToken("");
          setStatus("error");
        },
      });
      setStatus("waiting");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [action, siteKey]);

  useEffect(() => {
    if (!siteKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      return;
    }

    if (renderWidget()) return;

    // Multiple TurnstileField instances share one deduplicated Next.js Script.
    // Each instance must independently observe when the global API becomes ready;
    // relying only on one Script onLoad can leave later widgets unrendered.
    const interval = window.setInterval(() => {
      if (renderWidget()) window.clearInterval(interval);
    }, 100);

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      if (!widgetIdRef.current && !tokenRef.current) setStatus("blocked");
    }, 8_000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [renderWidget, siteKey]);

  useEffect(() => {
    const form = containerRef.current?.closest("form") as HTMLFormElement | null;
    if (!form) return;

    const handleSubmit = (event: SubmitEvent) => {
      if (tokenRef.current) return;
      event.preventDefault();
      pendingSubmitRef.current = true;

      if (status === "expired" || status === "error") {
        const api = window.turnstile;
        if (api && widgetIdRef.current) api.reset(widgetIdRef.current);
      }

      if (status !== "blocked") setStatus("waiting");
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [status]);

  useEffect(() => () => {
    if (widgetIdRef.current && window.turnstile?.remove) {
      window.turnstile.remove(widgetIdRef.current);
    }
  }, []);

  if (!siteKey) {
    return <div className="turnstile-shell is-error">Human verification is unavailable right now.</div>;
  }

  return (
    <div className={`turnstile-shell is-${status}`} aria-live="polite">
      <Script
        id="turnstile-api"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
        onError={() => setStatus("blocked")}
      />
      <div ref={containerRef} className="turnstile-field" />
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
      <div className="turnstile-status">
        <span className="turnstile-status-dot" aria-hidden="true" />
        <span>{statusCopy[status]}</span>
        {status === "blocked" ? (
          <button type="button" className="turnstile-retry" onClick={() => window.location.reload()}>
            Reload verification
          </button>
        ) : null}
      </div>
    </div>
  );
}
