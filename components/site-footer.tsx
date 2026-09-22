import Link from "next/link";

type SiteFooterProps = {
  className?: string;
};

export function SiteFooter({ className = "" }: SiteFooterProps) {
  const footerClass = ["pc-v6-footer", "pc-public-footer", className].filter(Boolean).join(" ");

  return (
    <footer className={footerClass}>
      <div className="pc-v6-shell">
        <strong>Pulsercuit</strong>
        <span>© 2026 · Free crypto rewards · FaucetPay payouts.</span>
        <nav aria-label="Public footer">
          <Link href="/">Home</Link>
          <Link href="/faucet">Faucet</Link>
          <Link href="/proof">Proof</Link>
          <Link href="/business">Business</Link>
          <Link href="/support">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
