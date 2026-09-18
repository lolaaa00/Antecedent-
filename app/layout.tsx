import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import { Web3Provider } from "@/lib/wallet/Web3Provider";
import { WalletProvider } from "@/lib/wallet/WalletContext";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--ff-display",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-ui",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--ff-meta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Antecedent — a chronology instrument for public events",
  description:
    "Antecedent is a consensus-backed sequence notary: it certifies that one public event materially occurred before, after, or was superseded by another, and exposes that certificate to downstream contracts on GenLayer Studionet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${interTight.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-ivory font-ui text-carbon antialiased">
        <Web3Provider>
          <WalletProvider>
            <SiteHeader />
            <main id="main">{children}</main>
          </WalletProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
