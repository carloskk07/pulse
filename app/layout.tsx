import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/pulse-v3-marketing.css";

function getMetadataBase() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  const candidates = [configured, vercelHost ? `https://${vercelHost}` : null, "https://example.com"];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      // Try the next safe candidate instead of breaking the production build.
    }
  }

  return new URL("https://example.com");
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Reward Pulse — Come back. Claim your Pulse.",
    template: "%s · Reward Pulse",
  },
  description:
    "A treasury-backed recurring reward network with optional Turbo earning and transparent payout proof.",
  applicationName: "Reward Pulse",
  manifest: "/manifest.webmanifest",
  keywords: ["recurring rewards", "crypto rewards", "reward network", "hourly rewards", "transparent payouts"],
  twitter: {
    card: "summary_large_image",
    title: "Reward Pulse",
    description: "Come back. Claim your Pulse. Turbo only when you choose.",
  },
  openGraph: {
    title: "Reward Pulse",
    description: "Treasury-backed recurring rewards with public proof and optional Turbo earning.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
