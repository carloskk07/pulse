import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    default: "Reward Pulse — Your spare minutes have value",
    template: "%s · Reward Pulse",
  },
  description:
    "Complete simple quests, build your streak and turn spare minutes into real rewards.",
  applicationName: "Reward Pulse",
  manifest: "/manifest.webmanifest",
  keywords: ["rewards", "crypto rewards", "quests", "surveys", "earn online"],
  twitter: { card: "summary_large_image", title: "Reward Pulse", description: "Your spare minutes have value." },
  openGraph: {
    title: "Reward Pulse",
    description: "Your spare minutes have value.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080a0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
