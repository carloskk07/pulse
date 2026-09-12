import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/auth", "/dashboard", "/earn", "/wallet", "/invite", "/r/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
