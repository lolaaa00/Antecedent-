"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useConnectorClient } from "wagmi";
import { CANONICAL_CHAIN_ID } from "@/lib/genlayer/network";
import { studionetChain } from "./wagmiConfig";

export type WalletStatus =
  | "NOT_DETECTED"
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "WRONG_NETWORK";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type WalletState = {
  status: WalletStatus;
  address: `0x${string}` | null;
  chainId: number | null;
  provider: Eip1193Provider | null;
  error: string | null;
};

type WalletContextValue = WalletState & {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToStudionet: () => Promise<void>;
  isCorrectNetwork: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected, isConnecting } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { data: connectorClient } = useConnectorClient();

  const status: WalletStatus = useMemo(() => {
    if (isConnecting) return "CONNECTING";
    if (!isConnected) return "DISCONNECTED";
    if (chainId !== CANONICAL_CHAIN_ID) return "WRONG_NETWORK";
    return "CONNECTED";
  }, [isConnected, isConnecting, chainId]);

  // Expose the connector's EIP-1193 provider for genlayer-js write clients
  const provider = useMemo<Eip1193Provider | null>(() => {
    if (!connectorClient) return null;
    return connectorClient.transport as unknown as Eip1193Provider;
  }, [connectorClient]);

  const connect = useMemo(
    () => async () => {
      const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
      if (injected) await connectAsync({ connector: injected });
    },
    [connectAsync, connectors],
  );

  const disconnect = useMemo(
    () => () => { disconnectAsync(); },
    [disconnectAsync],
  );

  const switchToStudionet = useMemo(
    () => async () => { await switchChainAsync({ chainId: studionetChain.id }); },
    [switchChainAsync],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address: address ?? null,
      chainId: chainId ?? null,
      provider,
      error: null,
      connect,
      disconnect,
      switchToStudionet,
      isCorrectNetwork: chainId === CANONICAL_CHAIN_ID,
    }),
    [status, address, chainId, provider, connect, disconnect, switchToStudionet],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
