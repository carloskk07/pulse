import type { NextRequest } from "next/server";

export function isTrustedSameOriginMutation(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    try {
      return new URL(origin).origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (!fetchSite) return false;
  if (fetchSite !== "same-origin" && fetchSite !== "none") return false;
  return fetchSite === "same-origin" || fetchSite === "none";
}

export async function readRequestBytesWithLimit(request: NextRequest, maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return null;

  const contentLengthHeader = request.headers.get("content-length")?.trim();
  if (contentLengthHeader) {
    const declaredBytes = Number(contentLengthHeader);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0 || declaredBytes > maxBytes) {
      return null;
    }
  }

  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readRequestTextWithLimit(request: NextRequest, maxBytes: number) {
  const bytes = await readRequestBytesWithLimit(request, maxBytes);
  if (!bytes) return null;

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}


export async function readUrlEncodedFormWithLimit(request: NextRequest, maxBytes: number) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") return null;

  const body = await readRequestTextWithLimit(request, maxBytes);
  if (body === null) return null;

  return new URLSearchParams(body);
}
