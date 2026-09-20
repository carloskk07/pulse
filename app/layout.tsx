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
    "Claim a Pulse, grow your Vault and withdraw when you're ready.",
  applicationName: "Pulsercuit",
  manifest: "/manifest.webmanifest",
  keywords: ["reward platform", "gamified rewards", "recurring rewards", "reward streaks", "transparent payouts", "Pulsercuit", "Pulse rewards"],
  twitter: {
    card: "summary_large_image",
    title: "Pulsercuit — Return. Rise. Repeat.",
    description: "Claim a Pulse, grow your Vault and keep moving.",
  },
  openGraph: {
    title: "Pulsercuit — Return. Rise. Repeat.",
    description: "A simpler reward loop built around Pulse, Vault and payout.",
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
