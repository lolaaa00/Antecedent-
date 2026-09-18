"use client";

import { useConnect } from "wagmi";
import { useEffect, useRef } from "react";

const WALLET_ICONS: Record<string, string> = {
  injected: "🦊",
  metaMask: "🦊",
  walletConnect: "🔗",
  coinbaseWallet: "🔵",
};

const WALLET_LABELS: Record<string, string> = {
  injected: "Browser Wallet",
  metaMask: "MetaMask",
  walletConnect: "WalletConnect",
  coinbaseWallet: "Coinbase Wallet",
};

export function WalletModal({ onClose }: { onClose: () => void }) {
  const { connect, connectors, isPending } = useConnect();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/40 backdrop-blur-sm">
      <div
        ref={ref}
        className="w-full max-w-sm border border-carbon/20 bg-ivory p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl italic">Connect wallet</h2>
          <button
            onClick={onClose}
            className="font-meta text-xs text-graphite hover:text-carbon"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 font-meta text-xs text-graphite">
          Connect to GenLayer Studionet (Chain 61999)
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              disabled={isPending}
              onClick={() => { connect({ connector }); onClose(); }}
              className="flex items-center gap-3 border border-carbon/20 px-4 py-3 text-left hover:bg-carbon/5 disabled:opacity-50 transition-colors"
            >
              <span className="text-xl" aria-hidden>
                {WALLET_ICONS[connector.id] ?? "💼"}
              </span>
              <span className="font-meta text-sm">
                {WALLET_LABELS[connector.id] ?? connector.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
