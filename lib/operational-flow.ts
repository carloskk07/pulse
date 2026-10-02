import "server-only";

import { randomUUID } from "node:crypto";

export type OperationalFlow = "claim" | "withdrawal";

type OperationalIssue = {
  stage: string;
  status?: string;
  code?: string;
  retryable?: boolean;
};

const REFERENCE_RE = /^(cl|wd)-[0-9a-f]{12}$/;

function boundedToken(value: string | undefined, max = 80) {
  const clean = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .slice(0, max);
  return clean || undefined;
}

export function createOperationalReference(flow: OperationalFlow) {
  const prefix = flow === "claim" ? "cl" : "wd";
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function cleanOperationalReference(
  value: unknown,
  flow?: OperationalFlow,
) {
  if (typeof value !== "string") return null;
  const reference = value.trim().toLowerCase();
  if (!REFERENCE_RE.test(reference)) return null;
  if (flow === "claim" && !reference.startsWith("cl-")) return null;
  if (flow === "withdrawal" && !reference.startsWith("wd-")) return null;
  return reference;
}

export function logOperationalIssue(
  flow: OperationalFlow,
  reference: string,
  issue: OperationalIssue,
) {
  const safeReference = cleanOperationalReference(reference, flow);
  if (!safeReference) return;

  const payload = {
    flow,
    reference: safeReference,
    stage: boundedToken(issue.stage, 100) ?? "unknown",
    status: boundedToken(issue.status),
    code: boundedToken(issue.code),
    retryable: issue.retryable === true,
  };

  console.error("PULSECIRCUIT_OPERATIONAL_ISSUE", JSON.stringify(payload));
}
