import type { Metadata, Viewport } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getCanonicalSiteUrl(),
  title: {
    default: "Pulsercuit — Free Crypto Rewards & FaucetPay Payouts",
    template: "%s · Pulsercuit",
  },
  description:
    "A free crypto rewards platform built around a recurring faucet, optional extra earning paths and FaucetPay payouts.",
  applicationName: "Pulsercuit",
  manifest: "/manifest.webmanifest",
  keywords: ["free crypto faucet", "crypto rewards", "FaucetPay rewards", "earn crypto", "recurring rewards", "transparent payouts", "Pulsercuit"],
  twitter: {
    card: "summary_large_image",
    title: "Pulsercuit — Free Crypto Rewards",
    description: "Claim recurring crypto rewards, see their real-dollar value and build toward FaucetPay payout.",
  },
  openGraph: {
    title: "Pulsercuit — Free Crypto Rewards",
    description: "Free crypto rewards with a recurring faucet, optional earning paths and transparent FaucetPay payouts.",
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
