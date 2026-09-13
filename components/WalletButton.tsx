"use client";

import { useWallet } from "@/lib/wallet/WalletContext";
import { shortHash } from "@/lib/genlayer/explorer";

export function WalletButton() {
  const wallet = useWallet();

  if (wallet.status === "NOT_DETECTED") {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="font-meta text-xs uppercase tracking-wide text-vermilion underline decoration-dotted"
      >
        Install a wallet
      </a>
    );
  }

  if (wallet.status === "CONNECTED") {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-cobalt" aria-hidden />
        <span className="font-meta text-xs text-carbon">{shortHash(wallet.address ?? "")}</span>
        <button
          onClick={wallet.disconnect}
          className="font-meta text-xs uppercase tracking-wide text-graphite underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (wallet.status === "WRONG_NETWORK") {
    return (
      <button
        onClick={wallet.switchToStudionet}
        className="font-meta text-xs uppercase tracking-wide text-vermilion"
      >
        Wrong network — switch to Studionet
      </button>
    );
  }

  return (
    <button
      onClick={wallet.connect}
      disabled={wallet.status === "CONNECTING"}
      className="border border-carbon px-3 py-1.5 font-meta text-xs uppercase tracking-wide hover:bg-carbon hover:text-ivory transition-colors disabled:opacity-50"
    >
      {wallet.status === "CONNECTING" ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
