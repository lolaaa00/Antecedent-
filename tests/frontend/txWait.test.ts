import { describe, expect, it } from "vitest";
import { waitForFinality } from "@/lib/genlayer/txWait";

type FakeReceipt = {
  statusName?: string;
  txExecutionResultName?: string;
  data?: Record<string, unknown>;
};

function makeClient(receipt: FakeReceipt) {
  return {
    waitForTransactionReceipt: async () => receipt,
  } as never;
}

const HASH = "0xdeadbeef" as `0x${string}`;

describe("waitForFinality", () => {
  it("returns SUCCESS for MAJORITY_AGREE", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", txExecutionResultName: "MAJORITY_AGREE" }),
      HASH,
    );
    expect(result.status).toBe("SUCCESS");
  });

  it("returns SUCCESS for execution result SUCCESS", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", txExecutionResultName: "SUCCESS" }),
      HASH,
    );
    expect(result.status).toBe("SUCCESS");
  });

  it("returns ERROR for NO_MAJORITY even when FINALIZED", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", txExecutionResultName: "NO_MAJORITY" }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/no majority/i);
  });

  it("returns ERROR for CANCELED", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "CANCELED", txExecutionResultName: undefined }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/CANCELED/);
  });

  it("returns ERROR for VALIDATORS_TIMEOUT", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "VALIDATORS_TIMEOUT", txExecutionResultName: undefined }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/VALIDATORS_TIMEOUT/);
  });

  it("returns ERROR for LEADER_TIMEOUT", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "LEADER_TIMEOUT", txExecutionResultName: undefined }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/LEADER_TIMEOUT/);
  });

  it("returns ERROR for FINISHED_WITH_ERROR (execution revert)", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
  });

  it("returns ERROR for any unknown execution result", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", txExecutionResultName: "SOME_FUTURE_VALUE" }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/unexpected consensus result/i);
  });
});
