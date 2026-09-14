import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/pulse-v3-marketing.css";
import "./styles/pulsercuit-v4.css";
import "./styles/pulsercuit-v4-1.css";
import "./styles/pulsercuit-v4-2.css";
import "./styles/pulsercuit-v5.css";

function getMetadataBase() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  const candidates = [configured, vercelHost ? `https://${vercelHost}` : null, "https://pulsercuit.pro"];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      // Try the next safe candidate instead of breaking the production build.
    }
  }

  return new URL("https://pulsercuit.pro");
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Pulsercuit — Turn consistency into momentum",
    template: "%s · Pulsercuit",
  },
  description:
    "Pulsercuit is a premium reward platform built around a clear return loop: claim funded Pulses, build visible progress and move toward transparent payouts.",
  applicationName: "Pulsercuit",
  manifest: "/manifest.webmanifest",
  keywords: ["reward platform", "recurring rewards", "hourly rewards", "transparent payouts", "Pulsercuit", "Pulse rewards"],
  twitter: {
    card: "summary_large_image",
    title: "Pulsercuit — Turn consistency into momentum",
    description: "Return when your Pulse opens. Claim what is funded. Build visible progress. Withdraw with clarity.",
  },
  openGraph: {
    title: "Pulsercuit — Turn consistency into momentum",
    description: "A premium reward loop built around funded Pulses, visible progress and transparent payout proof.",
    type: "website",
    siteName: "Pulsercuit",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060708",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
