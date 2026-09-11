import { getReleaseReadiness } from "@/lib/release-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getReleaseReadiness();
  return Response.json(
    {
      service: "reward-pulse",
      version: "0.1.0",
      readiness: report.state,
      ready: report.ready,
    },
    {
      status: report.ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
