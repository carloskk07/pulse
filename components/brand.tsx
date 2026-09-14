import { PulsercuitBrand } from "./pulsercuit-brand";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <PulsercuitBrand compact={compact} />;
}
