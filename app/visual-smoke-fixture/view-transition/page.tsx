import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ViewTransitionRuntimeFixture } from "@/components/view-transition-runtime-fixture";

export const dynamic = "force-dynamic";
export const metadata = { title: "ViewTransition runtime fixture" };

export default async function ViewTransitionRuntimeFixturePage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host")?.toLowerCase() ?? "";
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase() ?? "";
  const effectiveHost = forwardedHost || host;
  const localVisualHost = effectiveHost.startsWith("127.0.0.1:") || effectiveHost.startsWith("localhost:");
  if (!localVisualHost) notFound();

  return <ViewTransitionRuntimeFixture />;
}
