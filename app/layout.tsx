import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/pulse-v3-marketing.css";
import "./styles/pulsercuit-v4.css";

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
    default: "Pulsercuit — Return. Pulse. Repeat.",
    template: "%s · Pulsercuit",
  },
  description:
    "Pulsercuit is a treasury-backed recurring reward network built around a simple return rhythm, optional Turbo earning and public proof.",
  applicationName: "Pulsercuit",
  manifest: "/manifest.webmanifest",
  keywords: ["recurring rewards", "reward network", "hourly rewards", "transparent payouts", "Pulsercuit", "Pulse"],
  twitter: {
    card: "summary_large_image",
    title: "Pulsercuit",
    description: "Return. Pulse. Repeat. Turbo only when you choose.",
  },
  openGraph: {
    title: "Pulsercuit",
    description: "A transparent recurring reward circuit with treasury-backed Pulse rewards and optional Turbo earning.",
    type: "website",
    siteName: "Pulsercuit",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#040609",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
