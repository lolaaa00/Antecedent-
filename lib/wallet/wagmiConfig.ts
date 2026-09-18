import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";
import { CANONICAL_CHAIN_ID } from "@/lib/genlayer/network";

export const studionetChain = defineChain({
  id: CANONICAL_CHAIN_ID,
  name: "GenLayer Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://studio.genlayer.com/api"] },
  },
  blockExplorers: {
    default: { name: "Studionet Explorer", url: "https://explorer-studio.genlayer.com" },
  },
});

// WalletConnect project ID — replace with your own from https://cloud.walletconnect.com
const WC_PROJECT_ID = "b56e18d47c72ab683b10814fe9495694";

export const wagmiConfig = createConfig({
  chains: [studionetChain],
  connectors: [
    injected(),
    walletConnect({ projectId: WC_PROJECT_ID }),
  ],
  transports: {
    [CANONICAL_CHAIN_ID]: http("https://studio.genlayer.com/api"),
  },
  ssr: true,
});
