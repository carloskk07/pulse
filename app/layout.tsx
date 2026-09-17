import type { Metadata, Viewport } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getCanonicalSiteUrl(),
  title: {
    default: "Pulsercuit — Return. Rise. Repeat.",
    template: "%s · Pulsercuit",
  },
  description:
    "A cinematic reward circuit built around funded Pulses, visible momentum, shareable progress and a verified payout path.",
  applicationName: "Pulsercuit",
  manifest: "/manifest.webmanifest",
  keywords: ["reward platform", "gamified rewards", "recurring rewards", "reward streaks", "transparent payouts", "Pulsercuit", "Pulse rewards"],
  twitter: {
    card: "summary_large_image",
    title: "Pulsercuit — Return. Rise. Repeat.",
    description: "Build momentum through funded Pulses, milestones and evidence-backed progress.",
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
