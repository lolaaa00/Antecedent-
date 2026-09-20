import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTxLifecycle } from "@/lib/contract/txLifecycle";
import { CANONICAL_CHAIN_ID } from "@/lib/genlayer/network";

const OK_HASH = "0xabc123" as `0x${string}`;

describe("useTxLifecycle", () => {
  it("reports WRONG_NETWORK without ever calling write", async () => {
    const { result } = renderHook(() => useTxLifecycle());
    const write = async () => OK_HASH;
    let finalState;
    await act(async () => {
      finalState = await result.current.run({
        chainId: 61997,
        write,
        wait: async () => ({ status: "SUCCESS" as const }),
        reread: async () => {},
      });
    });
    expect(finalState!.failure).toBe("WRONG_NETWORK");
    expect(finalState!.stage).toBe("IDLE");
  });

  it("classifies a user-rejected signature", async () => {
    const { result } = renderHook(() => useTxLifecycle());
    let finalState;
    await act(async () => {
      finalState = await result.current.run({
        chainId: CANONICAL_CHAIN_ID,
        write: async () => {
          throw new Error("User rejected the request");
        },
        wait: async () => ({ status: "SUCCESS" as const }),
        reread: async () => {},
      });
    });
    expect(finalState!.failure).toBe("USER_REJECTED");
  });

  it("treats a finalized execution error as failure, not success", async () => {
    const { result } = renderHook(() => useTxLifecycle());
    let finalState;
    await act(async () => {
      finalState = await result.current.run({
        chainId: CANONICAL_CHAIN_ID,
        write: async () => OK_HASH,
        wait: async () => ({ status: "ERROR" as const, message: "execution reverted" }),
        reread: async () => {},
      });
    });
    expect(finalState!.failure).toBe("EXECUTION_ERROR");
    expect(finalState!.stage).toBe("FINALIZED");
  });

  it("reaches STATE_REREAD after a genuinely successful write", async () => {
    const { result } = renderHook(() => useTxLifecycle());
    let finalState;
    await act(async () => {
      finalState = await result.current.run({
        chainId: CANONICAL_CHAIN_ID,
        write: async () => OK_HASH,
        wait: async () => ({ status: "SUCCESS" as const }),
        reread: async () => {},
      });
    });
    expect(finalState!.stage).toBe("STATE_REREAD");
    expect(finalState!.failure).toBeNull();
    expect(finalState!.txHash).toBe(OK_HASH);
  });

  it("surfaces a state mismatch if the post-write reread fails", async () => {
    const { result } = renderHook(() => useTxLifecycle());
    let finalState;
    await act(async () => {
      finalState = await result.current.run({
        chainId: CANONICAL_CHAIN_ID,
        write: async () => OK_HASH,
        wait: async () => ({ status: "SUCCESS" as const }),
        reread: async () => {
          throw new Error("read failed");
        },
      });
    });
    expect(finalState!.failure).toBe("STATE_MISMATCH");
  });

  it("maps a NO_MAJORITY wait result to EXECUTION_ERROR failure", async () => {
    // waitForFinality returns ERROR for NO_MAJORITY; the lifecycle must surface this
    // as EXECUTION_ERROR at FINALIZED stage, not as success.
    const { result } = renderHook(() => useTxLifecycle());
    let finalState;
    await act(async () => {
      finalState = await result.current.run({
        chainId: CANONICAL_CHAIN_ID,
        write: async () => OK_HASH,
        wait: async () => ({ status: "ERROR" as const, message: "consensus reached no majority (NO_MAJORITY)" }),
        reread: async () => {},
      });
    });
    expect(finalState!.failure).toBe("EXECUTION_ERROR");
    expect(finalState!.stage).toBe("FINALIZED");
    expect(finalState!.errorMessage).toMatch(/no majority/i);
  });

  it("does not call reread when consensus fails", async () => {
    const { result } = renderHook(() => useTxLifecycle());
    let rereadCalled = false;
    await act(async () => {
      await result.current.run({
        chainId: CANONICAL_CHAIN_ID,
        write: async () => OK_HASH,
        wait: async () => ({ status: "ERROR" as const, message: "consensus reached no majority (NO_MAJORITY)" }),
        reread: async () => { rereadCalled = true; },
      });
    });
    expect(rereadCalled).toBe(false);
  });
});
