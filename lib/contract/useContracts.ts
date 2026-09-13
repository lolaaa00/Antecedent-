"use client";

import { useMemo } from "react";
import { getReadClient, createWriteClient } from "@/lib/genlayer/client";
import { NOTARY_ADDRESS, GATE_ADDRESS, requireAddress } from "./addresses";
import { notaryAdapter } from "./notary";
import { gateAdapter } from "./gate";
import { useWallet } from "@/lib/wallet/WalletContext";

export function useDeploymentStatus() {
  return {
    notaryDeployed: Boolean(NOTARY_ADDRESS),
    gateDeployed: Boolean(GATE_ADDRESS),
  };
}

export function useNotaryRead() {
  return useMemo(() => {
    if (!NOTARY_ADDRESS) return null;
    const address = requireAddress(NOTARY_ADDRESS, "NOTARY_ADDRESS");
    return notaryAdapter(getReadClient(), address);
  }, []);
}

export function useGateRead() {
  return useMemo(() => {
    if (!GATE_ADDRESS) return null;
    const address = requireAddress(GATE_ADDRESS, "GATE_ADDRESS");
    return gateAdapter(getReadClient(), address);
  }, []);
}

export function useNotaryWrite() {
  const wallet = useWallet();
  return useMemo(() => {
    if (!NOTARY_ADDRESS || !wallet.address || !wallet.provider || !wallet.isCorrectNetwork) return null;
    const address = requireAddress(NOTARY_ADDRESS, "NOTARY_ADDRESS");
    const client = createWriteClient(wallet.address, wallet.provider);
    return { client, adapter: notaryAdapter(client, address) };
  }, [wallet.address, wallet.provider, wallet.isCorrectNetwork]);
}

export function useGateWrite() {
  const wallet = useWallet();
  return useMemo(() => {
    if (!GATE_ADDRESS || !wallet.address || !wallet.provider || !wallet.isCorrectNetwork) return null;
    const address = requireAddress(GATE_ADDRESS, "GATE_ADDRESS");
    const client = createWriteClient(wallet.address, wallet.provider);
    return { client, adapter: gateAdapter(client, address) };
  }, [wallet.address, wallet.provider, wallet.isCorrectNetwork]);
}
