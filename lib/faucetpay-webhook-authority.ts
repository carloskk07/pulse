import "server-only";

export const FAUCETPAY_WEBHOOK_SECRET_MIN_LENGTH = 32;
export const FAUCETPAY_WEBHOOK_SECRET_MAX_LENGTH = 512;

export function getFaucetPayWebhookSecret() {
  const secret = process.env.FAUCETPAY_WEBHOOK_SECRET?.trim() ?? "";
  if (
    secret.length < FAUCETPAY_WEBHOOK_SECRET_MIN_LENGTH
    || secret.length > FAUCETPAY_WEBHOOK_SECRET_MAX_LENGTH
  ) {
    return null;
  }
  return secret;
}

export function hasFaucetPayWebhookRuntimeAuthority() {
  return getFaucetPayWebhookSecret() !== null;
}
