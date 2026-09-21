import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_RE = /^[0-9a-f]{64}$/;

function secret() {
  const value = process.env.PULSE_ADS_CHECKOUT_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function payload(campaignId: string, checkoutReference: string) {
  return `ad:${campaignId}:${checkoutReference}`;
}

function signature(value: string, key: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function pulseAdsCheckoutReady() {
  return Boolean(process.env.PULSE_ADS_MERCHANT_USERNAME?.trim() && secret());
}

export function buildPulseAdsCheckoutCustom(campaignId: string, checkoutReference: string) {
  const key = secret();
  if (!key || !UUID_RE.test(campaignId) || !UUID_RE.test(checkoutReference)) return null;
  const value = payload(campaignId, checkoutReference);
  return `${value}:${signature(value, key)}`;
}

export function verifyPulseAdsCheckoutCustom(value: string) {
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "ad") return null;

  const campaignId = parts[1] ?? "";
  const checkoutReference = parts[2] ?? "";
  const suppliedSignature = parts[3] ?? "";
  const key = secret();

  if (!key || !UUID_RE.test(campaignId) || !UUID_RE.test(checkoutReference) || !SIGNATURE_RE.test(suppliedSignature)) {
    return null;
  }

  const valueToSign = payload(campaignId, checkoutReference);
  const expected = signature(valueToSign, key);
  const suppliedBuffer = Buffer.from(suppliedSignature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return null;
  }

  return { campaignId, checkoutReference };
}
