import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const ArrowUpRight = (p: Props) => <Icon {...p}><path d="M7 17 17 7"/><path d="M7 7h10v10"/></Icon>;
export const Bolt = (p: Props) => <Icon {...p}><path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/></Icon>;
export const Wallet = (p: Props) => <Icon {...p}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v12H6.5A2.5 2.5 0 0 1 4 15.5v-9Z"/><path d="M16 10h4v4h-4a2 2 0 1 1 0-4Z"/></Icon>;
export const Home = (p: Props) => <Icon {...p}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></Icon>;
export const Users = (p: Props) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Icon>;
export const Check = (p: Props) => <Icon {...p}><path d="m5 12 4 4L19 6"/></Icon>;
export const Clock = (p: Props) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
export const Spark = (p: Props) => <Icon {...p}><path d="m12 3 1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></Icon>;
export const Shield = (p: Props) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></Icon>;
export const Trend = (p: Props) => <Icon {...p}><path d="M3 17 9 11l4 4 8-9"/><path d="M14 6h7v7"/></Icon>;
