import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com").replace(/\/$/, "");
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/support`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/rewards-policy`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
