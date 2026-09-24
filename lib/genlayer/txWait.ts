import type { getReadClient } from "./client";

type AnyClient = ReturnType<typeof getReadClient>;

export type WaitResult = { status: "SUCCESS" | "ERROR"; message?: string };

// GenLayer's consensus result is exposed as numeric values by the current SDK,
// while some RPC versions expose the enum name directly. Both are accepted;
// a finalized receipt without MAJORITY_AGREE is never a successful write.
const RESULT_NO_MAJORITY = 5;
const RESULT_MAJORITY_AGREE = 6;

function consensusResult(receipt: Record<string, unknown>): "MAJORITY_AGREE" | "NO_MAJORITY" | undefined {
  const nested = receipt.consensus_data;
  const data = nested && typeof nested === "object" ? nested as Record<string, unknown> : undefined;
  const candidates = [
    receipt.result,
    receipt.consensusResultName,
    receipt.consensus_result,
    receipt.consensusResult,
    data?.consensus_result_name,
    data?.consensus_result,
    data?.consensusResult,
    data?.result,
  ];
  for (const value of candidates) {
    if (value === RESULT_MAJORITY_AGREE || value === "MAJORITY_AGREE") return "MAJORITY_AGREE";
    if (value === RESULT_NO_MAJORITY || value === "NO_MAJORITY") return "NO_MAJORITY";
  }
  return undefined;
}

/**
 * Waits for GenVM consensus to finalize a transaction. Finalized is only a
 * lifecycle status: the receipt must also contain MAJORITY_AGREE, and an
 * explicit execution error still fails the write.
 */
export async function waitForFinality(client: AnyClient, hash: `0x${string}`): Promise<WaitResult> {
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as never,
    status: "FINALIZED" as never,
    retries: 60,
    interval: 3000,
  });

  const r = receipt as {
    statusName?: string;
    txExecutionResultName?: string;
    result?: number | string;
    consensusResultName?: string;
    consensus_result?: string;
    consensusResult?: string;
    consensus_data?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };

  if (r.statusName !== "FINALIZED") {
    return { status: "ERROR", message: `consensus did not finalize: ${r.statusName ?? "unknown"}` };
  }

  const decidedResult = consensusResult(r as Record<string, unknown>);
  if (decidedResult !== "MAJORITY_AGREE") {
    return {
      status: "ERROR",
      message: `finalized without successful consensus (result: ${decidedResult ?? "unknown"})`,
    };
  }

  if (r.txExecutionResultName === "FINISHED_WITH_ERROR") {
    const message = r.data && typeof r.data === "object" ? JSON.stringify(r.data) : "execution reverted";
    return { status: "ERROR", message };
  }

  if (r.txExecutionResultName === "FINISHED_WITH_RETURN" || r.txExecutionResultName === undefined) {
    return { status: "SUCCESS" };
  }

  return {
    status: "ERROR",
    message: `unexpected execution state: ${r.txExecutionResultName}`,
  };
}
