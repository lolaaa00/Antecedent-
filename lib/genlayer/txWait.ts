import type { getReadClient } from "./client";

type AnyClient = ReturnType<typeof getReadClient>;

export type WaitResult = { status: "SUCCESS" | "ERROR"; message?: string };

// Raw numeric consensus result values from the GenLayer TransactionResult enum.
// The SDK maps the receipt's numeric `result` field to txExecutionResultName, but
// the mapping only covers ExecutionResult (0–2); the consensus result (5 = NO_MAJORITY,
// 6 = MAJORITY_AGREE) is carried in the raw `result` field and never populates
// txExecutionResultName. We check both fields to make accurate decisions.
const RESULT_NO_MAJORITY = 5;
const RESULT_MAJORITY_AGREE = 6;

/**
 * Waits for GenVM consensus to finalize a transaction, then inspects both
 * the execution result (FINISHED_WITH_RETURN / FINISHED_WITH_ERROR) and the
 * consensus vote result (MAJORITY_AGREE / NO_MAJORITY) from the raw receipt.
 * Never resolves "success" from a tx hash alone.
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
    result?: number;
    data?: Record<string, unknown>;
  };

  // Terminal status-level failures — consensus never completed.
  if (r.statusName === "CANCELED" || r.statusName === "VALIDATORS_TIMEOUT" || r.statusName === "LEADER_TIMEOUT") {
    return { status: "ERROR", message: `consensus did not finalize: ${r.statusName}` };
  }

  // Numeric consensus result: NO_MAJORITY means validators disagreed — not a success.
  if (r.result === RESULT_NO_MAJORITY) {
    return { status: "ERROR", message: "consensus reached no majority (NO_MAJORITY)" };
  }

  // GenVM execution-level failure: contract raised an exception.
  if (r.txExecutionResultName === "FINISHED_WITH_ERROR") {
    const message =
      r.data && typeof r.data === "object" ? JSON.stringify(r.data) : "execution reverted";
    return { status: "ERROR", message };
  }

  // Explicit execution success.
  if (r.txExecutionResultName === "FINISHED_WITH_RETURN") {
    return { status: "SUCCESS" };
  }

  // Numeric consensus success: MAJORITY_AGREE with no execution error = success.
  if (r.result === RESULT_MAJORITY_AGREE) {
    return { status: "SUCCESS" };
  }

  // Any other combination is unexpected — surface for diagnosis.
  return {
    status: "ERROR",
    message: `unexpected receipt state: statusName=${r.statusName} result=${r.result} executionResult=${r.txExecutionResultName}`,
  };
}
