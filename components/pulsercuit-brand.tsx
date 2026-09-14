import Link from "next/link";

export function PulsercuitBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Pulsercuit home">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      {!compact && <span className="brand-word">Pulsercuit</span>}
    </Link>
  );
}
