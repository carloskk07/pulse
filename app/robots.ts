import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getCanonicalSiteUrl().origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/admin", "/auth", "/dashboard", "/earn", "/wallet", "/invite", "/r/", "/return"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
