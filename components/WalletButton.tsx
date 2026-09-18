"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet/WalletContext";
import { shortHash } from "@/lib/genlayer/explorer";
import { WalletModal } from "./WalletModal";

export function WalletButton() {
  const wallet = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

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
    <>
      <button
        onClick={() => setModalOpen(true)}
        disabled={wallet.status === "CONNECTING"}
        className="border border-carbon px-3 py-1.5 font-meta text-xs uppercase tracking-wide hover:bg-carbon hover:text-ivory transition-colors disabled:opacity-50"
      >
        {wallet.status === "CONNECTING" ? "Connecting…" : "Connect wallet"}
      </button>
      {modalOpen && <WalletModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
