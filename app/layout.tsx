import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com"),
  title: {
    default: "Reward Pulse — Your spare minutes have value",
    template: "%s · Reward Pulse",
  },
  description:
    "Complete simple quests, build your streak and turn spare minutes into real rewards.",
  applicationName: "Reward Pulse",
  keywords: ["rewards", "crypto rewards", "quests", "surveys", "earn online"],
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
