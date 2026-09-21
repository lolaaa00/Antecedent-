import { describe, expect, it } from "vitest";
import { waitForFinality } from "@/lib/genlayer/txWait";

type FakeReceipt = {
  statusName?: string;
  txExecutionResultName?: string;
  result?: number;
  data?: Record<string, unknown>;
};

function makeClient(receipt: FakeReceipt) {
  return {
    waitForTransactionReceipt: async () => receipt,
  } as never;
}

const HASH = "0xdeadbeef" as `0x${string}`;

// Numeric consensus result values (GenLayer TransactionResult enum)
const MAJORITY_AGREE = 6;
const NO_MAJORITY = 5;

describe("waitForFinality", () => {
  it("returns SUCCESS when result=MAJORITY_AGREE (numeric 6)", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", result: MAJORITY_AGREE }),
      HASH,
    );
    expect(result.status).toBe("SUCCESS");
  });

  it("returns SUCCESS when txExecutionResultName is FINISHED_WITH_RETURN", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" }),
      HASH,
    );
    expect(result.status).toBe("SUCCESS");
  });

  it("returns ERROR for NO_MAJORITY (numeric 5) even when FINALIZED", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", result: NO_MAJORITY }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/no majority/i);
  });

  it("returns ERROR for FINISHED_WITH_ERROR (contract exception)", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
  });

  it("returns ERROR for CANCELED", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "CANCELED" }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/CANCELED/);
  });

  it("returns ERROR for VALIDATORS_TIMEOUT", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "VALIDATORS_TIMEOUT" }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/VALIDATORS_TIMEOUT/);
  });

  it("returns ERROR for LEADER_TIMEOUT", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "LEADER_TIMEOUT" }),
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/LEADER_TIMEOUT/);
  });

  it("returns ERROR for unexpected receipt with no known success signal", async () => {
    const result = await waitForFinality(
      makeClient({ statusName: "FINALIZED" }), // no result, no executionResultName
      HASH,
    );
    expect(result.status).toBe("ERROR");
    expect(result.message).toMatch(/unexpected receipt state/i);
  });
});
