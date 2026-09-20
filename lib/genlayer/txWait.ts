import type { getReadClient } from "./client";

type AnyClient = ReturnType<typeof getReadClient>;

export type WaitResult = { status: "SUCCESS" | "ERROR"; message?: string };

/**
 * Waits for GenVM consensus to finalize a transaction, then inspects the
 * *execution* result — a FINALIZED status with FINISHED_WITH_ERROR is a
 * finalized failure, not a success. Never resolve "success" from a tx hash
 * alone.
 */
export async function waitForFinality(client: AnyClient, hash: `0x${string}`): Promise<WaitResult> {
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as never,
    status: "FINALIZED" as never,
    retries: 60,
    interval: 3000,
  });

  const executionResult = (receipt as { txExecutionResultName?: string }).txExecutionResultName;
  const statusName = (receipt as { statusName?: string }).statusName;

  if (statusName === "CANCELED" || statusName === "VALIDATORS_TIMEOUT" || statusName === "LEADER_TIMEOUT") {
    return { status: "ERROR", message: `consensus did not finalize: ${statusName}` };
  }

  // FINALIZED + NO_MAJORITY means validators did not reach agreement — not a success.
  if (executionResult === "NO_MAJORITY") {
    return { status: "ERROR", message: `consensus reached no majority (${executionResult})` };
  }

  // FINISHED_WITH_ERROR: extract detail from receipt data if available.
  if (executionResult === "FINISHED_WITH_ERROR") {
    const data = (receipt as { data?: Record<string, unknown> }).data;
    const message = data && typeof data === "object" ? JSON.stringify(data) : "execution reverted";
    return { status: "ERROR", message };
  }

  // undefined means the SDK did not populate the field on this receipt — treat as success
  // on a FINALIZED receipt (the status-level checks above already caught the bad cases).
  // Only block additional known-bad explicit values here.
  if (executionResult !== undefined && executionResult !== "MAJORITY_AGREE" && executionResult !== "SUCCESS") {
    return { status: "ERROR", message: `unexpected consensus result: ${executionResult}` };
  }

  return { status: "SUCCESS" };
}
