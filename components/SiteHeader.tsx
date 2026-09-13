import Link from "next/link";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/new", label: "New" },
  { href: "/timeline", label: "Timeline" },
  { href: "/gates", label: "Gates" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-carbon/15 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl italic">Antecedent</span>
          <span className="hidden font-meta text-[10px] uppercase tracking-[0.2em] text-graphite sm:inline">
            chronology instrument
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden gap-6 font-meta text-xs uppercase tracking-wide md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-cobalt">
              {item.label}
            </Link>
          ))}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
