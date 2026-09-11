export async function GET() {
  return Response.json({
    ok: true,
    service: "reward-pulse",
    version: "0.1.0",
  });
}
