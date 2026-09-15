import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/pulse-v3-marketing.css";
import "./styles/pulsercuit-v4.css";
import "./styles/pulsercuit-v4-1.css";
import "./styles/pulsercuit-v4-2.css";
import "./styles/pulsercuit-v5.css";
import "./styles/pulsercuit-v5-1.css";
import "./styles/pulsercuit-v5-1-surfaces.css";
import "./styles/pulsercuit-v6.css";

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
    default: "Pulsercuit — Return. Rise. Repeat.",
    template: "%s · Pulsercuit",
  },
  description:
    "A cinematic reward circuit built around funded Pulses, visible momentum, shareable progress and verified payout proof.",
  applicationName: "Pulsercuit",
  manifest: "/manifest.webmanifest",
  keywords: ["reward platform", "gamified rewards", "recurring rewards", "reward streaks", "transparent payouts", "Pulsercuit", "Pulse rewards"],
  twitter: {
    card: "summary_large_image",
    title: "Pulsercuit — Return. Rise. Repeat.",
    description: "Claim funded Pulses. Build status. Unlock milestones. Share the climb.",
  },
  openGraph: {
    title: "Pulsercuit — Return. Rise. Repeat.",
    description: "A premium reward ritual built around Pulse, Momentum, Vault and Share.",
    type: "website",
    siteName: "Pulsercuit",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020404",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
