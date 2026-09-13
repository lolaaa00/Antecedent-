import { describe, expect, it } from "vitest";
import { assertCanonicalNetwork, CANONICAL_CHAIN_ID, CANONICAL_RPC_URL, NETWORK } from "@/lib/genlayer/network";

describe("assertCanonicalNetwork", () => {
  it("passes for the real studionet chain config", () => {
    expect(assertCanonicalNetwork(NETWORK)).toEqual({ ok: true });
    expect(NETWORK.id).toBe(CANONICAL_CHAIN_ID);
  });

  it("rejects a wrong chain id", () => {
    const result = assertCanonicalNetwork({ id: 61997 });
    expect(result.ok).toBe(false);
  });

  it("rejects a mismatched rpc url", () => {
    const result = assertCanonicalNetwork({
      id: CANONICAL_CHAIN_ID,
      rpcUrls: { default: { http: ["https://studio-dev.genlayer.com/api"] } },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts the canonical rpc url", () => {
    const result = assertCanonicalNetwork({
      id: CANONICAL_CHAIN_ID,
      rpcUrls: { default: { http: [CANONICAL_RPC_URL] } },
    });
    expect(result.ok).toBe(true);
  });
});
