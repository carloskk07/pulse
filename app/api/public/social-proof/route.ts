import { NextResponse } from "next/server";
import { getPublicSocialProof } from "@/lib/social-proof";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const proof = await getPublicSocialProof();

  return NextResponse.json(proof, {
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
